import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  FlatList,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';

import FoldTransport from './modules/fold-transport/src/FoldTransportModule';

import type {
  FoldPeer,
  FoldConnectionState,
} from './modules/fold-transport/src/FoldTransport.types';

export default function App() {
  const [status, setStatus] = useState('Starting...');
  const [peers, setPeers] = useState<FoldPeer[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const peerFoundSubscription =
      FoldTransport.addListener(
        'peerFound',
        (peer: FoldPeer) => {
          if (!mounted) {
            return;
          }

          setPeers((currentPeers) => {
            const exists = currentPeers.some(
              (existingPeer) =>
                existingPeer.name === peer.name &&
                existingPeer.domain === peer.domain
            );

            if (exists) {
              return currentPeers;
            }

            return [...currentPeers, peer];
          });
        }
      );

    const peerLostSubscription =
      FoldTransport.addListener(
        'peerLost',
        (peer: FoldPeer) => {
          if (!mounted) {
            return;
          }

          setPeers((currentPeers) =>
            currentPeers.filter(
              (existingPeer) =>
                !(
                  existingPeer.name === peer.name &&
                  existingPeer.domain === peer.domain
                )
            )
          );
        }
      );

    const connectionSubscription =
      FoldTransport.addListener(
        'connectionChanged',
        (state: FoldConnectionState) => {
          if (!mounted) {
            return;
          }

          setStatus(state.state);

          if (state.error) {
            setError(state.error);
          } else {
            setError(null);
          }
        }
      );

    startTransport();

    return () => {
      mounted = false;

      peerFoundSubscription.remove();
      peerLostSubscription.remove();
      connectionSubscription.remove();

      FoldTransport.stop().catch(() => {});
    };
  }, []);

  async function startTransport() {
    try {
      setStatus('STARTING');
      setError(null);

      const deviceName = 'FoldLink';

      await FoldTransport.start(deviceName);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      setStatus('ERROR');
      setError(message);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>
          FoldLink
        </Text>

        <Text style={styles.subtitle}>
          Real nearby-device discovery
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>
          TRANSPORT
        </Text>

        <Text style={styles.status}>
          {status}
        </Text>

        {error && (
          <Text style={styles.error}>
            {error}
          </Text>
        )}
      </View>

      <View style={styles.devicesSection}>
        <Text style={styles.sectionTitle}>
          Nearby FoldLink Devices
        </Text>

        {peers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              No device found
            </Text>

            <Text style={styles.emptyText}>
              FoldLink is listening for another
              device advertising the _foldlink._tcp
              service.
            </Text>
          </View>
        ) : (
          <FlatList
            data={peers}
            keyExtractor={(peer) =>
              `${peer.name}-${peer.domain}`
            }
            renderItem={({ item }) => (
              <View style={styles.peerCard}>
                <View>
                  <Text style={styles.peerName}>
                    {item.name}
                  </Text>

                  <Text style={styles.peerDetail}>
                    {item.type}
                  </Text>

                  <Text style={styles.peerDetail}>
                    {item.domain}
                  </Text>
                </View>

                <View style={styles.foundBadge}>
                  <Text style={styles.foundText}>
                    FOUND
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
  },

  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#666666',
  },

  statusCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 1,
  },

  status: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },

  error: {
    marginTop: 10,
    fontSize: 13,
    color: '#C62828',
  },

  devicesSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 14,
  },

  empty: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#666666',
  },

  peerCard: {
    marginBottom: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  peerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
  },

  peerDetail: {
    marginTop: 4,
    fontSize: 12,
    color: '#777777',
  },

  foundBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
  },

  foundText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
  },
});