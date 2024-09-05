// src/app/peer/peer.tsx
"use client"

import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';

const PeerPage = () => {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const callingVideoRef = useRef<HTMLVideoElement>(null);
  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [myUniqueId, setMyUniqueId] = useState<string>("");
  const [idToCall, setIdToCall] = useState('');
  const [incomingCall, setIncomingCall] = useState<Peer.MediaConnection | null>(null);
  const [showCallAlert, setShowCallAlert] = useState<boolean>(false);

  const generateRandomString = () => Math.random().toString(36).substring(2);

  const handleCall = () => {
    navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    }).then(stream => {
      const call = peerInstance?.call(idToCall, stream);
      if (call) {
        call.on('stream', userVideoStream => {
          if (callingVideoRef.current) {
            callingVideoRef.current.srcObject = userVideoStream;
          }
        });
      }
    });
  };

  const answerCall = () => {
    if (incomingCall && peerInstance) {
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      }).then(stream => {
        incomingCall.answer(stream);
        incomingCall.on('stream', userVideoStream => {
          if (callingVideoRef.current) {
            callingVideoRef.current.srcObject = userVideoStream;
          }
        });
        setShowCallAlert(false);
      });
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.close();
      setShowCallAlert(false);
    }
  };

  useEffect(() => {
    if (myUniqueId) {
      let peer: Peer;
      if (typeof window !== 'undefined') {
        peer = new Peer(myUniqueId, {
          host: 'localhost',
          port: 9000,
          path: '/myapp',
        });

        setPeerInstance(peer);

        navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        }).then(stream => {
          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
          }

          peer.on('call', call => {
            setIncomingCall(call);
            setShowCallAlert(true);
          });
        });
      }
      return () => {
        if (peer) {
          peer.destroy();
        }
      };
    }
  }, [myUniqueId]);

  useEffect(() => {
    setMyUniqueId(generateRandomString());
  }, []);

  return (
    <div className='flex flex-col justify-center items-center p-12'>
      <p>Your ID: {myUniqueId}</p>
      <video className='w-72' playsInline ref={myVideoRef} autoPlay />
      <input
        className='text-black'
        placeholder="ID to call"
        value={idToCall}
        onChange={e => setIdToCall(e.target.value)}
      />
      <button onClick={handleCall}>Call</button>
      <video className='w-72' playsInline ref={callingVideoRef} autoPlay />

      {showCallAlert && (
        <div className='fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 border border-gray-300 rounded'>
          <p>Incoming Call from {incomingCall?.peer}</p>
          <button onClick={answerCall} className='bg-green-500 text-white px-4 py-2 rounded mr-2'>Accept</button>
          <button onClick={rejectCall} className='bg-red-500 text-white px-4 py-2 rounded'>Reject</button>
        </div>
      )}
    </div>
  );
};

export default PeerPage;
