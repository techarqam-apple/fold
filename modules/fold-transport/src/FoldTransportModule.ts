import { NativeModule, requireNativeModule } from "expo";

export type FoldPeer = {
  name: string;
  type: string;
  domain: string;
  interface: string;
};

export type FoldConnectionState = {
  state:
    | "LISTENING"
    | "BROWSING"
    | "CONNECTED"
    | "DISCONNECTED"
    | "STOPPED"
    | "ERROR";

  error?: string;
};

export type FoldTransportModuleEvents = {
  peerFound: (peer: FoldPeer) => void;
  peerLost: (peer: FoldPeer) => void;
  connectionChanged: (state: FoldConnectionState) => void;
};

declare class FoldTransportModule extends NativeModule<FoldTransportModuleEvents> {
  start(deviceName: string): Promise<void>;

  stop(): Promise<void>;
}

export default requireNativeModule<FoldTransportModule>("FoldTransport");
