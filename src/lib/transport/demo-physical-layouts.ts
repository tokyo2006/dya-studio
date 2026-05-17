import type {
  Request,
  Response,
} from "../../proto/zmk/physical_layouts/physical_layouts";

export const PHYSICAL_LAYOUTS_IDENTIFIER = "zmk__physical_layouts";

export class PhysicalLayoutsHandler {
  process(request: Request): Response {
    if (request.getPhysicalLayout) {
      return {
        physicalLayout: {
          devices: [
            {
              identifier: "trackball0",
              displayName: "Primary Trackball",
              enabled: true,
              links: [
                {
                  deviceIdentifier: "trackball_sensor",
                  subsystemIdentifier: "zmk__trackball",
                },
              ],
              trackball: {
                attrs: {
                  x: 200,
                  y: 660,
                  size: 150,
                },
              },
            },
            {
              identifier: "touchpad0",
              displayName: "Touch Pad",
              enabled: true,
              links: [
                {
                  deviceIdentifier: "touchpad_input",
                  subsystemIdentifier: "zmk__touch_pad",
                },
              ],
              touchPad: {
                attrs: {
                  width: 220,
                  height: 130,
                  x: 400,
                  y: 660,
                  r: 0,
                  rx: 0,
                  ry: 0,
                },
              },
            },
          ],
          rotaryEncoders: [
            {
              enabled: true,
              attrs: {
                x: 700,
                y: 660,
                size: 150,
              },
            },
          ],
        },
      };
    }

    return {
      error: {
        message: "Unknown physical layout request",
      },
    };
  }
}
