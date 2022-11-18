/* eslint-disable no-console */

import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { mplex } from '@libp2p/mplex';
import { noise } from '@chainsafe/libp2p-noise';
import { bootstrap } from '@libp2p/bootstrap';
import { mdns } from '@libp2p/mdns';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';

const bootstrapNodes = [
  '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
];

const createNode = async (bootstrappers: string[]) => {
  const node = await createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0'],
    },
    transports: [tcp()],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    // we add the Pubsub module we want
    pubsub: gossipsub({ allowPublishToZeroPeers: true }),
    peerDiscovery: [
      bootstrap({
        list: bootstrappers,
      }),
      pubsubPeerDiscovery({
        interval: 1000,
      }) as any,
      mdns({
        interval: 20e3,
      }),
    ],
    relay: {
      enabled: true, // Allows you to dial and accept relayed connections. Does not make you a relay.
      hop: {
        enabled: true, // Allows you to be a relay for other peers
        active: true,
      },
    },
  });

  return node;
};

const topic = 'macaua';

(async () => {
  const [node1, node2] = await Promise.all([createNode(bootstrapNodes), createNode(bootstrapNodes)]);

  node1.addEventListener('peer:discovery', (evt) => {
    const peer = evt.detail;
    console.log(`Peer ${node1.peerId.toString()} discovered: ${peer.id.toString()}`);
  });
  node2.addEventListener('peer:discovery', (evt) => {
    const peer = evt.detail;
    console.log(`Peer ${node2.peerId.toString()} discovered: ${peer.id.toString()}`);
  });
  [node1, node2].forEach((node, index) => console.log(`Node ${index} starting with id: ${node.peerId.toString()}`));
  await Promise.all([node1.start(), node2.start()]);

  node1.pubsub.addEventListener('message', (evt) => {
    if (evt?.detail?.topic === topic) {
      console.log(`node1_mac received: ${uint8ArrayToString(evt.detail.data)} on topic ${evt.detail.topic}`);
    }
  });
  node1.pubsub.subscribe(topic);

  // Will not receive own published messages by default
  node2.pubsub.addEventListener('message', (evt) => {
    if (evt?.detail?.topic === topic) {
      console.log(`received message: ${uint8ArrayToString(evt.detail.data)} on topic ${evt.detail.topic}`);
    }
  });
  node2.pubsub.subscribe(topic);

  // node2 publishes "news" every second
  setInterval(() => {
    node2.pubsub
      .publish(topic, uint8ArrayFromString(`I am ${node2.peerId.toString()} and I want to play ${topic}`))
      .catch((err) => {
        console.error(err);
      });
  }, 1000);
})();
