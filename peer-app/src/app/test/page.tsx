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

    const socketRef = useRef<Socket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    const startButton = useRef<HTMLButtonElement | null>(null);
    const hangupButton = useRef<HTMLButtonElement | null>(null);
    const muteAudButton = useRef<HTMLButtonElement | null>(null);
    const remoteVideo = useRef<HTMLVideoElement | null>(null);
    const localVideo = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        // Initialize socket connection
        const socket = io("http://localhost:8888", { transports: ["websocket"] });
        socketRef.current = socket;

        socket.on("message", handleSocketMessage);

        return () => {
            // Clean up on unmount
            socket.off("message", handleSocketMessage);
            socket.close();
            hangup();
        };
    }, []);

    const handleSocketMessage = (message: Message) => {
        if (!localStreamRef.current) {
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
                if (pcRef.current) {
                    console.log("already in call, ignoring");
                    return;
                }
                makeCall();
                break;
            case "bye":
                if (pcRef.current) {
                    hangup();
                }
                break;
            default:
                console.log("unhandled", message);
                break;
        }
    };

    const makeCall = async () => {
        if (confirm("Do you want to make a call?")) {
            console.log("calling");
        } else {
            console.log("canceled");
            return;
        }
        try {
            const pc = new RTCPeerConnection(configuration);
            pcRef.current = pc;

            pc.onicecandidate = (e) => {
                const message: CandidateMessage = { type: "candidate" };
                if (e.candidate) {
                    message.candidate = e.candidate.candidate;
                    message.sdpMid = e.candidate.sdpMid;
                    message.sdpMLineIndex = e.candidate.sdpMLineIndex;
                }
                socketRef.current?.emit("message", message);
            };

            pc.ontrack = (e) => {
                if (remoteVideo.current) {
                    remoteVideo.current.srcObject = e.streams[0];
                }
            };

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) =>
                    pc.addTrack(track, localStreamRef.current!)
                );
            }

            const offer = await pc.createOffer();
            socketRef.current?.emit("message", { type: "offer", sdp: offer.sdp });
            await pc.setLocalDescription(offer);
        } catch (e) {
            console.log(e);
        }
    };

    const handleOffer = async (offer: OfferMessage) => {
        if (pcRef.current) {
            console.error("existing peerconnection");
            return;
        }
        try {
            const pc = new RTCPeerConnection(configuration);
            pcRef.current = pc;

            pc.onicecandidate = (e) => {
                const message: CandidateMessage = { type: "candidate" };
                if (e.candidate) {
                    message.candidate = e.candidate.candidate;
                    message.sdpMid = e.candidate.sdpMid;
                    message.sdpMLineIndex = e.candidate.sdpMLineIndex;
                }
                socketRef.current?.emit("message", message);
            };

            pc.ontrack = (e) => {
                if (remoteVideo.current) {
                    remoteVideo.current.srcObject = e.streams[0];
                }
            };

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) =>
                    pc.addTrack(track, localStreamRef.current!)
                );
            }

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            socketRef.current?.emit("message", { type: "answer", sdp: answer.sdp });
            await pc.setLocalDescription(answer);
        } catch (e) {
            console.log(e);
        }
    };

    const handleAnswer = async (answer: AnswerMessage) => {
        if (!pcRef.current) {
            console.error("no peerconnection");
            return;
        }
        try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
            console.log(e);
        }
    };

    const handleCandidate = async (candidate: CandidateMessage) => {
        if (!pcRef.current) {
            console.error("no peerconnection");
            return;
        }
        try {
            if (candidate.candidate) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                await pcRef.current.addIceCandidate(null);
            }
        } catch (e) {
            console.log(e);
        }
    };

    const hangup = async () => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
        if (startButton.current) startButton.current.disabled = false;
        if (hangupButton.current) hangupButton.current.disabled = true;
        if (muteAudButton.current) muteAudButton.current.disabled = true;
    };

    const startB = async () => {
        try {
            const localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
            });
            localStreamRef.current = localStream;

            if (localVideo.current) {
                localVideo.current.srcObject = localStream;
            }
        } catch (err) {
            console.log(err);
        }

        if (startButton.current) startButton.current.disabled = true;
        if (hangupButton.current) hangupButton.current.disabled = false;
        if (muteAudButton.current) muteAudButton.current.disabled = false;

        socketRef.current?.emit("message", { type: "ready" });
    };

    const hangB = async () => {
        await hangup();
        socketRef.current?.emit("message", { type: "bye" });
    };

    const muteAudio = () => {
        if (localVideo.current) {
            localVideo.current.muted = !audiostate;
            setAudio(!audiostate);
        }
    };

    return (
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
    );
}

export default App;
