import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";

type WebUsbDeviceFilterLike = {
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  vendorId?: number;
  productId?: number;
};

type WebUsbEndpointLike = {
  endpointNumber: number;
  direction: "in" | "out";
  packetSize: number;
  type: "bulk" | "interrupt" | "isochronous";
};

type WebUsbAlternateInterfaceLike = {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: WebUsbEndpointLike[];
};

type WebUsbInterfaceLike = {
  interfaceNumber: number;
  alternates: WebUsbAlternateInterfaceLike[];
};

type WebUsbConfigurationLike = {
  configurationValue: number;
  interfaces: WebUsbInterfaceLike[];
};

type WebUsbTransferResultLike = {
  data?: DataView;
  status: "ok" | "stall" | "babble";
};

type WebUsbDeviceLike = {
  configuration: WebUsbConfigurationLike | null;
  configurations: WebUsbConfigurationLike[];
  opened: boolean;
  productId?: number;
  productName?: string;
  vendorId?: number;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (configurationValue: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  releaseInterface: (interfaceNumber: number) => Promise<void>;
  selectAlternateInterface?: (
    interfaceNumber: number,
    alternateSetting: number,
  ) => Promise<void>;
  transferIn: (
    endpointNumber: number,
    length: number,
  ) => Promise<WebUsbTransferResultLike>;
  transferOut: (
    endpointNumber: number,
    data: Uint8Array,
  ) => Promise<{ status: "ok" | "stall" }>;
  clearHalt?: (
    direction: "in" | "out",
    endpointNumber: number,
  ) => Promise<void>;
};

type WebUsbCdcEndpoints = {
  interfaceNumber: number;
  alternateSetting: number;
  inEndpoint: WebUsbEndpointLike;
  outEndpoint: WebUsbEndpointLike;
};

type NavigatorWithWebUsb = Navigator & {
  usb?: {
    requestDevice: (options: {
      filters: WebUsbDeviceFilterLike[];
    }) => Promise<WebUsbDeviceLike>;
  };
};

const webUsbCdcFilters: WebUsbDeviceFilterLike[] = [
  { classCode: 0x02 },
  { classCode: 0x0a },
];

export async function connect(): Promise<RpcTransport> {
  const usb = (navigator as NavigatorWithWebUsb).usb;
  if (!usb) throw new Error("WebUSB is not available in this browser");

  const device = await usb.requestDevice({ filters: webUsbCdcFilters });
  await device.open().catch((caught) => {
    if (caught instanceof DOMException && caught.name === "NetworkError") {
      throw new Error(
        "Failed to open the WebUSB device. Check the permissions of the device and verify it is not in use by another process.",
        { cause: caught },
      );
    }
    throw caught;
  });

  try {
    if (!device.configuration) {
      const configurationValue = device.configurations[0]?.configurationValue;
      if (configurationValue === undefined) {
        throw new Error("No USB configuration is available on this device.");
      }
      await device.selectConfiguration(configurationValue);
    }

    const endpoints = findWebUsbCdcEndpoints(device.configuration);
    if (!endpoints) {
      throw new Error(
        "No CDC bulk data interface was found on the selected WebUSB device.",
      );
    }

    await device.claimInterface(endpoints.interfaceNumber).catch((caught) => {
      throw new Error(
        "Failed to claim the CDC interface on the WebUSB device. Check that it is not in use by another app or browser tab.",
        { cause: caught },
      );
    });

    if (endpoints.alternateSetting !== 0) {
      await device.selectAlternateInterface?.(
        endpoints.interfaceNumber,
        endpoints.alternateSetting,
      );
    }

    const abortController = new AbortController();
    const close = createWebUsbCloseHandler(device, endpoints.interfaceNumber);
    abortController.signal.addEventListener("abort", () => void close(), {
      once: true,
    });

    return {
      label: createWebUsbLabel(device),
      abortController,
      readable: createWebUsbReadableStream(
        device,
        endpoints.inEndpoint,
        abortController,
      ),
      writable: createWebUsbWritableStream(
        device,
        endpoints.outEndpoint,
        abortController,
      ),
    };
  } catch (caught) {
    await closeWebUsbDevice(device).catch((closeError) => {
      console.warn(
        "Failed to close ZMK WebUSB device after error.",
        closeError,
      );
    });
    throw caught;
  }
}

function findWebUsbCdcEndpoints(
  configuration: WebUsbConfigurationLike | null,
): WebUsbCdcEndpoints | null {
  const candidates: WebUsbCdcEndpoints[] = [];

  for (const usbInterface of configuration?.interfaces ?? []) {
    for (const alternate of usbInterface.alternates) {
      const inEndpoint = alternate.endpoints.find(
        (endpoint) => endpoint.type === "bulk" && endpoint.direction === "in",
      );
      const outEndpoint = alternate.endpoints.find(
        (endpoint) => endpoint.type === "bulk" && endpoint.direction === "out",
      );
      if (!inEndpoint || !outEndpoint) continue;

      const candidate = {
        interfaceNumber: usbInterface.interfaceNumber,
        alternateSetting: alternate.alternateSetting,
        inEndpoint,
        outEndpoint,
      };
      candidates.push(candidate);
      if (alternate.interfaceClass === 0x0a) return candidate;
    }
  }

  return candidates[0] ?? null;
}

function createWebUsbReadableStream(
  device: WebUsbDeviceLike,
  endpoint: WebUsbEndpointLike,
  abortController: AbortController,
) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      void pumpWebUsbIn(device, endpoint, abortController.signal, controller);
    },
    cancel() {
      abortController.abort();
    },
  });
}

async function pumpWebUsbIn(
  device: WebUsbDeviceLike,
  endpoint: WebUsbEndpointLike,
  signal: AbortSignal,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  while (!signal.aborted) {
    try {
      const result = await device.transferIn(
        endpoint.endpointNumber,
        endpoint.packetSize,
      );
      if (signal.aborted) return;

      if (result.status === "stall") {
        await device.clearHalt?.("in", endpoint.endpointNumber);
        continue;
      }
      if (result.status !== "ok") {
        throw new Error(`WebUSB transferIn failed with ${result.status}.`);
      }
      if (result.data?.byteLength) {
        controller.enqueue(dataViewToUint8Array(result.data));
      }
    } catch (caught) {
      if (!signal.aborted) controller.error(caught);
      return;
    }
  }
}

function createWebUsbWritableStream(
  device: WebUsbDeviceLike,
  endpoint: WebUsbEndpointLike,
  abortController: AbortController,
) {
  return new WritableStream<Uint8Array>({
    async write(chunk) {
      if (abortController.signal.aborted) {
        throw new DOMException("WebUSB connection is closed.", "AbortError");
      }
      await writeWebUsbChunks(device, endpoint, chunk);
    },
    abort() {
      abortController.abort();
    },
  });
}

async function writeWebUsbChunks(
  device: WebUsbDeviceLike,
  endpoint: WebUsbEndpointLike,
  chunk: Uint8Array,
) {
  for (
    let offset = 0;
    offset < chunk.byteLength;
    offset += endpoint.packetSize
  ) {
    const slice = chunk.subarray(offset, offset + endpoint.packetSize);
    const result = await device.transferOut(endpoint.endpointNumber, slice);
    if (result.status === "stall") {
      await device.clearHalt?.("out", endpoint.endpointNumber);
      throw new Error("WebUSB transferOut stalled.");
    }
    if (result.status !== "ok") {
      throw new Error(`WebUSB transferOut failed with ${result.status}.`);
    }
  }
}

function createWebUsbCloseHandler(
  device: WebUsbDeviceLike,
  interfaceNumber: number,
) {
  let closePromise: Promise<void> | null = null;
  return () => {
    closePromise ??= closeWebUsbDevice(device, interfaceNumber).catch(
      (caught) => {
        console.warn("Failed to close ZMK WebUSB device.", caught);
      },
    );
    return closePromise;
  };
}

async function closeWebUsbDevice(
  device: WebUsbDeviceLike,
  interfaceNumber?: number,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(attempt === 0 ? 0 : 50);
    try {
      if (interfaceNumber !== undefined) {
        await device.releaseInterface(interfaceNumber).catch((caught) => {
          if (!isWebUsbDeviceAlreadyClosed(caught)) throw caught;
        });
      }
      if (device.opened) await device.close();
      return;
    } catch (caught) {
      if (attempt === 9 || isWebUsbDeviceAlreadyClosed(caught)) {
        if (!isWebUsbDeviceAlreadyClosed(caught)) throw caught;
        return;
      }
    }
  }
}

function createWebUsbLabel(device: WebUsbDeviceLike) {
  const vendorId = device.vendorId?.toLocaleString() || "";
  const productId = device.productId?.toLocaleString() || "";
  return [device.productName, `${vendorId}:${productId}`]
    .filter(Boolean)
    .join(" ");
}

function isWebUsbDeviceAlreadyClosed(caught: unknown) {
  return (
    caught instanceof DOMException &&
    caught.name === "InvalidStateError" &&
    /not open|already closed/i.test(caught.message)
  );
}

function dataViewToUint8Array(data: DataView) {
  return new Uint8Array(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  );
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}
