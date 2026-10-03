import ExpoModulesCore
import Foundation
import Network

public class FoldTransportModule: Module {

  private let serviceType = "_foldlink._tcp"

  private var listener: NWListener?
  private var browser: NWBrowser?

  // Connections to discovered peers.
  private var connections: [String: NWConnection] = [:]

  public func definition() -> ModuleDefinition {
    Name("FoldTransport")

    Events(
      "peerFound",
      "peerLost",
      "connectionChanged"
    )

    AsyncFunction("start") { (deviceName: String) in
      self.start(deviceName: deviceName)
    }

    AsyncFunction("stop") {
      self.stop()
    }
  }

  // MARK: - Lifecycle

  private func start(deviceName: String) {
    stop()

    startListener(deviceName: deviceName)
    startBrowser()
  }

  private func stop() {
    for connection in connections.values {
      connection.cancel()
    }

    connections.removeAll()

    listener?.cancel()
    listener = nil

    browser?.cancel()
    browser = nil
  }

  // MARK: - Listener

  private func startListener(deviceName: String) {

    let parameters = NWParameters.tcp
    parameters.includePeerToPeer = true

    do {

      let listener = try NWListener(using: parameters)

      listener.service = NWListener.Service(
        name: deviceName,
        type: serviceType
      )

      listener.stateUpdateHandler = { [weak self] state in

        switch state {

        case .ready:

          self?.sendEvent("connectionChanged", [
            "state": "LISTENING"
          ])

        case .failed(let error):

          self?.sendEvent("connectionChanged", [
            "state": "ERROR",
            "error": error.localizedDescription
          ])

        case .cancelled:

          self?.sendEvent("connectionChanged", [
            "state": "STOPPED"
          ])

        default:
          break
        }
      }

      listener.newConnectionHandler = { [weak self] connection in

        self?.acceptConnection(connection)
      }

      listener.start(queue: .main)

      self.listener = listener

    } catch {

      sendEvent("connectionChanged", [
        "state": "ERROR",
        "error": error.localizedDescription
      ])
    }
  }

  // MARK: - Accept Incoming Connection

  private func acceptConnection(
    _ connection: NWConnection
  ) {

    let connectionID = UUID().uuidString

    connections[connectionID] = connection

    connection.stateUpdateHandler = {
      [weak self] state in

      switch state {

      case .ready:

        self?.sendEvent("connectionChanged", [
          "state": "CONNECTED"
        ])

        self?.receiveNext(
          connection,
          connectionID: connectionID
        )

      case .failed(let error):

        self?.removeConnection(
          connectionID: connectionID
        )

        self?.sendEvent("connectionChanged", [
          "state": "ERROR",
          "error": error.localizedDescription
        ])

      case .cancelled:

        self?.removeConnection(
          connectionID: connectionID
        )

        self?.sendEvent("connectionChanged", [
          "state": "DISCONNECTED"
        ])

      default:
        break
      }
    }

    connection.start(queue: .main)
  }

  // MARK: - Browser

  private func startBrowser() {

    let parameters = NWParameters.tcp
    parameters.includePeerToPeer = true

    let browser = NWBrowser(
      for: .bonjour(
        type: serviceType,
        domain: nil
      ),
      using: parameters
    )

    browser.stateUpdateHandler = { [weak self] state in

      switch state {

      case .ready:

        self?.sendEvent("connectionChanged", [
          "state": "BROWSING"
        ])

      case .failed(let error):

        self?.sendEvent("connectionChanged", [
          "state": "ERROR",
          "error": error.localizedDescription
        ])

      case .cancelled:

        self?.sendEvent("connectionChanged", [
          "state": "STOPPED"
        ])

      default:
        break
      }
    }

    browser.browseResultsChangedHandler = {
      [weak self] results, changes in

      for change in changes {

        switch change {

        case .added(let result):

          self?.handlePeerAdded(result)

        case .removed(let result):

          self?.handlePeerRemoved(result)

        case .changed(let old, let new):

          self?.handlePeerRemoved(old)
          self?.handlePeerAdded(new)

        case .identical:

          break

        @unknown default:

          break
        }
      }
    }

    browser.start(queue: .main)

    self.browser = browser
  }

  // MARK: - Peer Added

  private func handlePeerAdded(
    _ result: NWBrowser.Result
  ) {

    switch result.endpoint {

    case .service(
      let name,
      let type,
      let domain,
      let interface
    ):

      sendEvent("peerFound", [
        "name": name,
        "type": type,
        "domain": domain,
        "interface": interface.debugDescription
      ])

      connectToPeer(result)

    default:

      break
    }
  }

  // MARK: - Peer Removed

  private func handlePeerRemoved(
    _ result: NWBrowser.Result
  ) {

    switch result.endpoint {

    case .service(
      let name,
      let type,
      let domain,
      let interface
    ):

      sendEvent("peerLost", [
        "name": name,
        "type": type,
        "domain": domain,
        "interface": interface.debugDescription
      ])

    default:

      break
    }
  }

  // MARK: - Connect To Peer

  private func connectToPeer(
    _ result: NWBrowser.Result
  ) {

    let connectionID = endpointIdentifier(
      result.endpoint
    )

    if connections[connectionID] != nil {
      return
    }

    let parameters = NWParameters.tcp
    parameters.includePeerToPeer = true

    let connection = NWConnection(
      to: result.endpoint,
      using: parameters
    )

    connections[connectionID] = connection

    connection.stateUpdateHandler = {
      [weak self] state in

      switch state {

      case .ready:

        self?.sendEvent("connectionChanged", [
          "state": "CONNECTED"
        ])

        self?.receiveNext(
          connection,
          connectionID: connectionID
        )

      case .failed(let error):

        self?.removeConnection(
          connectionID: connectionID
        )

        self?.sendEvent("connectionChanged", [
          "state": "ERROR",
          "error": error.localizedDescription
        ])

      case .cancelled:

        self?.removeConnection(
          connectionID: connectionID
        )

        self?.sendEvent("connectionChanged", [
          "state": "DISCONNECTED"
        ])

      default:

        break
      }
    }

    connection.start(queue: .main)
  }

  // MARK: - Receive

  private func receiveNext(
    _ connection: NWConnection,
    connectionID: String
  ) {

    connection.receive(
      minimumIncompleteLength: 1,
      maximumLength: 64 * 1024
    ) {
      [weak self]
      data,
      context,
      isComplete,
      error in

      if let error {

        self?.sendEvent("connectionChanged", [
          "state": "ERROR",
          "error": error.localizedDescription
        ])

        self?.removeConnection(
          connectionID: connectionID
        )

        return
      }

      if isComplete {

        self?.removeConnection(
          connectionID: connectionID
        )

        self?.sendEvent("connectionChanged", [
          "state": "DISCONNECTED"
        ])

        return
      }

      if let data,
         !data.isEmpty {

        // Message handling will be implemented
        // in the next transport stage.
        print(
          "FoldLink received \(data.count) bytes"
        )
      }

      self?.receiveNext(
        connection,
        connectionID: connectionID
      )
    }
  }

  // MARK: - Helpers

  private func removeConnection(
    connectionID: String
  ) {

    connections[connectionID]?.cancel()
    connections.removeValue(
      forKey: connectionID
    )
  }

  private func endpointIdentifier(
    _ endpoint: NWEndpoint
  ) -> String {

    switch endpoint {

    case .service(
      let name,
      let type,
      let domain,
      _
    ):

      return "\(name)|\(type)|\(domain)"

    default:

      return endpoint.debugDescription
    }
  }
}