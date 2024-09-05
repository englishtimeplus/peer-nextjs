'use client'

import { io, Socket } from "socket.io-client";
import { useRef, useEffect, useState } from "react";
import { FiVideo, FiVideoOff, FiMic, FiMicOff } from "react-icons/fi";

interface CandidateMessage {
    type: "candidate";
    candidate?: string;
    sdpMid?: string;
    sdpMLineIndex?: number;
}

interface OfferMessage {
    type: "offer";
    sdp: string;
}

interface AnswerMessage {
    type: "answer";
    sdp: string;
}

interface ByeMessage {
    type: "bye";
}

interface ReadyMessage {
    type: "ready";
}

type Message = CandidateMessage | OfferMessage | AnswerMessage | ByeMessage | ReadyMessage;

const configuration: RTCConfiguration = {
    iceServers: [
        {
            urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
        },
    ],
    iceCandidatePoolSize: 10,
};
function App() {
    const [audiostate, setAudio] = useState(false);


    const socket: Socket = io("http://localhost:8888", { transports: ["websocket"] });

    let pc: RTCPeerConnection | null = null;
    let localStream: MediaStream | null = null;
    let startButton = useRef<HTMLButtonElement | null>();
    let hangupButton = useRef<HTMLButtonElement | null>();
    let muteAudButton = useRef<HTMLButtonElement | null>();
    let remoteVideo = useRef<HTMLVideoElement | null>();
    let localVideo = useRef<HTMLVideoElement | null>();

    socket.on("message", (message: Message) => {
        if (!localStream) {
            console.log("not ready yet");
            return;
        }
        switch (message.type) {
            case "offer":
                handleOffer(message as OfferMessage);
                break;
            case "answer":
                handleAnswer(message as AnswerMessage);
                break;
            case "candidate":
                handleCandidate(message as CandidateMessage);
                break;
            case "ready":
                if (pc) {
                    console.log("already in call, ignoring");
                    return;
                }
                makeCall();
                break;
            case "bye":
                if (pc) {
                    hangup();
                }
                break;
            default:
                console.log("unhandled", message);
                break;
        }
    });

    async function makeCall() {
        try {
            pc = new RTCPeerConnection(configuration);
            pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
                const message: CandidateMessage = { type: "candidate" };
                if (e.candidate) {
                    message.candidate = e.candidate.candidate;
                    message.sdpMid = e.candidate.sdpMid;
                    message.sdpMLineIndex = e.candidate.sdpMLineIndex;
                }
                socket.emit("message", message);
            };
            pc.ontrack = (e: RTCTrackEvent) => {
                if (remoteVideo.current) {
                    remoteVideo.current.srcObject = e.streams[0];
                }
            };
            if (localStream) {
                localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
            }
            const offer = await pc.createOffer();
            socket.emit("message", { type: "offer", sdp: offer.sdp });
            await pc.setLocalDescription(offer);
        } catch (e) {
            console.log(e);
        }
    }

    async function handleOffer(offer: OfferMessage) {
        if (pc) {
            console.error("existing peerconnection");
            return;
        }
        try {
            pc = new RTCPeerConnection(configuration);
            pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
                const message: CandidateMessage = { type: "candidate" };
                if (e.candidate) {
                    message.candidate = e.candidate.candidate;
                    message.sdpMid = e.candidate.sdpMid;
                    message.sdpMLineIndex = e.candidate.sdpMLineIndex;
                }
                socket.emit("message", message);
            };
            pc.ontrack = (e: RTCTrackEvent) => {
                if (remoteVideo.current) {
                    remoteVideo.current.srcObject = e.streams[0];
                }
            };
            if (localStream) {
                if (pc) {

                    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
                }
                // localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
            }
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            socket.emit("message", { type: "answer", sdp: answer.sdp });
            await pc.setLocalDescription(answer);
        } catch (e) {
            console.log(e);
        }
    }

    async function handleAnswer(answer: AnswerMessage) {
        if (!pc) {
            console.error("no peerconnection");
            return;
        }
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
            console.log(e);
        }
    }

    async function handleCandidate(candidate: CandidateMessage) {
        if (!pc) {
            console.error("no peerconnection");
            return;
        }
        try {
            if (candidate.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                await pc.addIceCandidate(null);
            }
        } catch (e) {
            console.log(e);
        }
    }

    async function hangup() {
        if (pc) {
            pc.close();
            pc = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
            localStream = null;
        }
        if (startButton.current) startButton.current.disabled = false;
        if (hangupButton.current) hangupButton.current.disabled = true;
        if (muteAudButton.current) muteAudButton.current.disabled = true;
    }


    useEffect(() => {
        if (hangupButton.current) hangupButton.current.disabled = true;
        if (muteAudButton.current) muteAudButton.current.disabled = true;
    }, []);

    const startB = async () => {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                // audio: { echoCancellation: false },
                audio: false,
            });
            if (localVideo.current) {
                localVideo.current.srcObject = localStream;
            }
        } catch (err) {
            console.log(err);
        }

        if (startButton.current) startButton.current.disabled = true;
        if (hangupButton.current) hangupButton.current.disabled = false;
        if (muteAudButton.current) muteAudButton.current.disabled = false;

        socket.emit("message", { type: "ready" });
    };

    const hangB = async () => {
        await hangup();
        socket.emit("message", { type: "bye" });
    };

    const muteAudio = () => {
        if (localVideo.current) {
            localVideo.current.muted = !audiostate;
            setAudio(!audiostate);
        }
    };

    return (
        <>
            <main className="container">
                <div className="video bg-main">
                    <video
                        ref={localVideo}
                        className="video-item"
                        autoPlay
                        playsInline
                        muted
                    ></video>
                    <video
                        ref={remoteVideo}
                        className="video-item"
                        autoPlay
                        playsInline
                    ></video>
                </div>

                <div className="flex gap-6">
                    <button
                        className="btn-item btn-start"
                        ref={startButton}
                        onClick={startB}
                    >
                        <FiVideo />
                    </button>
                    <button
                        className="btn-item btn-end"
                        ref={hangupButton}
                        onClick={hangB}
                    >
                        <FiVideoOff />
                    </button>
                    <button
                        className="btn-item btn-start"
                        ref={muteAudButton}
                        onClick={muteAudio}
                    >
                        {audiostate ? <FiMic /> : <FiMicOff />}
                    </button>
                </div>
            </main>
        </>
    );
}

export default App;
