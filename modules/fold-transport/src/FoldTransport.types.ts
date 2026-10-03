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
