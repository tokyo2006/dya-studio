import {
  Notification,
  Request,
  Response,
} from "../../proto/zmk/input_stream/input_stream";

export const INPUT_STREAM_IDENTIFIER = "zmk__input_stream";

export class InputStreamHandler {
  private enabled = false;
  private position = 0;

  process(request: Request): Response {
    if (request.enableStream !== undefined) {
      this.enabled = true;
      return { ok: {} };
    }

    if (request.disableStream !== undefined) {
      this.enabled = false;
      return { ok: {} };
    }

    return { error: { message: "Unknown input stream request" } };
  }

  notify(callback: (payload: Uint8Array) => void) {
    setInterval(() => {
      if (!this.enabled) return;

      const position = this.position;
      this.position = (this.position + 1) % 24;

      callback(
        Notification.encode({
          keyEvent: {
            position,
            pressed: true,
            behaviorId: 0,
            param1: 0,
            param2: 0,
          },
        }).finish(),
      );

      setTimeout(() => {
        callback(
          Notification.encode({
            keyEvent: {
              position,
              pressed: false,
              behaviorId: 0,
              param1: 0,
              param2: 0,
            },
          }).finish(),
        );
      }, 220);
    }, 700);
  }
}
