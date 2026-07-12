import { useContext } from "react";
import { ZMKAppContext } from "@cormoran/zmk-studio-react-hook";
import { useCustomSubsystem } from "./useCustomSubsystem";
import { Request, Response } from "../proto/cormoran/devtool/devtool";

export const DEVTOOL_SUBSYSTEM_IDENTIFIER = "cormoran__devtool";

const CODEC = {
  encode: (request: Request) => Request.encode(request).finish(),
  decode: (payload: Uint8Array) => Response.decode(payload),
};

export function useDevtool() {
  const zmkApp = useContext(ZMKAppContext);
  const { subsystem, ready, call } = useCustomSubsystem(
    DEVTOOL_SUBSYSTEM_IDENTIFIER,
    CODEC,
  );

  return {
    isAvailable: subsystem !== null,
    ready,
    call,
    subsystemIndex: subsystem?.index,
    zmkApp,
  };
}
