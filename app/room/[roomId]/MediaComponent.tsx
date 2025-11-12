'use client'
import React, { useState, useEffect, useCallback, useRef, CSSProperties } from "react";
import {
  MODE,
  ModeType,
  destroyRealtime,
  participantType,
  registerSetMode,
  setModeState,
  setStreamState,
  startSignaling,
  RTCEventEmitter,
  registerSetParticipants,
  broadcastModeChange,
  broadCastUserNames,
  setCurrentStateName,
  registerSetUserNames,
  broadcastMeetingState,
  registerSetIsMeeting,
  sendMeetingInvite,
  getMyId,
  registerSetShowInviteNotification,
  renegotiate,
  handleMute,
  getSelfId,
  sendJoinMeetingRequest,
  sendJoinMeetingResponse,
  registerSetShowJoinRequestNotification,
  getAllPlayers,
} from "../../../game/realtime/PlayerRealtime";
import { useUser, useAuth, useOrganization } from "@clerk/nextjs";
import { Mic, MicOff, PenSquare, PhoneOff, Video } from "lucide-react";
import {
  Init,
  participantDataType,
  setNewParticipantServerAction,
  setParticipantBlobChunk,
  stopMeeting,
  stopRecorder,
  type MeetingSummary,
  saveMeetingSummary,
} from "@/app/actions/Summary";

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────
const CSS: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  backgroundColor: "black",
  width: "90%",
  height: "80%",
  display: "flex",
  transform: "translate(-50%,-50%)",
};

type propType = {
  handleOpenWhiteboard: () => void;
  set: React.Dispatch<React.SetStateAction<boolean>>;
  children: React.ReactNode;
  isWhiteboardOpen: boolean;
  roomId: string;
};

export default function MediaComponent(props: propType) {
  const { orgRole } = useAuth();
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();

  const getUserRole = (): string => {
    if (!orgRole) return "member";
    return orgRole.replace("org:", "");
  };

  const audioRefs = useRef<{ [id: string]: HTMLAudioElement | null }>({});
  const myVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRefs = useRef<{ [id: string]: HTMLVideoElement | null }>({});
  const recorder = useRef<MediaRecorder | null>(null);
  const currentParticipantIdRef = useRef<string | null>(null);

  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<ModeType>(MODE.PROXIMITY);
  const [participants, setParticipants] = useState<participantType[]>([]);
  const [userRole, setUserRole] = useState<string>(getUserRole());
  const [userNames, setUserNames] = useState<{ [id: string]: string }>({});
  const [isMeeting, setIsMeeting] = useState<boolean>(false);
  const [members, setMembers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [meetingHost, setMeetingHost] = useState<string | null>(null);

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────
  function updateMode(m: ModeType) {
    setMode(m);
    setModeState(m);
  }

  function updateMyStream(s: MediaStream) {
    setMyStream(s);
    setStreamState(s);
  }

  // ──────────────────────────────────────────────
  // RECORDER
  // ──────────────────────────────────────────────
  const handleRecorder = useCallback(
    async (s: MediaStream) => {
      const audioTracks = s.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error("No audio tracks in stream");
        return;
      }

      const audioOnlyStream = new MediaStream(audioTracks);
      const participantId = getSelfId();

      if (!participantId || participantId === "notSet") {
        console.error("Invalid participant ID:", participantId);
        return;
      }

      let participantName = "";
      if (members.length > 0 && user) {
        const currentUserMember = members.find((m) => m.id === user.id);
        participantName =
          currentUserMember?.name ||
          user.fullName ||
          user.username ||
          user.primaryEmailAddress?.emailAddress ||
          "";
      } else if (user) {
        participantName =
          user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "";
      }

      currentParticipantIdRef.current = participantId;
      const logName = participantName || participantId;

      console.log(`🎧 [${logName}] Recorder starting... ID: ${participantId}`);

      const n: participantDataType = {
        id: participantId,
        name: participantName || undefined,
        offset: Date.now(),
        chunks: [],
        isFinished: false,
      };

      // ✅ Register the participant on server first
      await setNewParticipantServerAction(n);
      console.log(`✅ [${logName}] Registered participant on server.`);

      recorder.current = new MediaRecorder(audioOnlyStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorder.current.start(2500); // record every 2.5s chunk

      recorder.current.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          console.log(
            `🎤 [${logName}] Sending chunk ${(
              e.data.size / 1024
            ).toFixed(2)}KB to server...`
          );
          await setParticipantBlobChunk(participantId, e.data, Date.now()).catch((error) =>
            console.error(`❌ Error sending chunk for ${logName}:`, error)
          );
        }
      };

      recorder.current.onstop = async () => {
        console.log(`🛑 [${logName}] Recorder stopped.`);
        const result = await stopRecorder(participantId, Date.now());
        if (result) {
          console.log(`📝 [${logName}] Transcript (preview): ${result.text.slice(0, 200)}`);
        } else {
          console.warn(`⚠️ [${logName}] No transcript received.`);
        }
      };
    },
    [recorder, members, user]
  );

  // ──────────────────────────────────────────────
  // MEETING LIFECYCLE
  // ──────────────────────────────────────────────
  const handleStartMeeting = useCallback(async () => {
    console.log("🚀 Starting meeting...");
    await Init(Date.now());
    console.log("🕐 Meeting initialized on server.");

    const newStream: MediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    await handleRecorder(newStream);

    updateMode(MODE.MEETING);
    broadcastModeChange(MODE.MEETING);
    const hostId = user?.id || getSelfId() || undefined;
    broadcastMeetingState(true, hostId);
    props.set(true);
    setIsMeeting(true);
    if (hostId) setMeetingHost(hostId);
    renegotiate(newStream, MODE.MEETING);
  }, [user]);

  const handleJoinMeeting = useCallback(async () => {
    console.log("🔔 Joining meeting...");
    await Init(Date.now()); // ensure meetingStartTime is set
    const newStream: MediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    await handleRecorder(newStream);
    updateMode(MODE.MEETING);
    broadcastModeChange(MODE.MEETING);
    props.set(true);
    setIsMeeting(true);
    renegotiate(newStream, MODE.MEETING);
  }, []);

  const handleLeaveMeeting = useCallback(async () => {
    console.log("📞 Leaving meeting...");
    recorder.current?.stop();

    const selfId = getSelfId();
    const otherParticipants = participants.filter(
      (p) => p.mode === MODE.MEETING && p.id !== selfId && p.id !== user?.id
    );

    if (otherParticipants.length === 0) {
      console.log("🛑 No other participants — stopping meeting and summarizing...");
      const result = await stopMeeting(props.roomId);
      if (!result) {
        console.error("❌ No summary returned from stopMeeting()");
        return;
      }

      console.log("🧾 Summary generated, saving to Supabase...");
      await saveMeetingSummary(result, props.roomId);
    }

    const newStream: MediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    updateMode(MODE.PROXIMITY);
    broadcastModeChange(MODE.PROXIMITY);
    props.set(false);
    renegotiate(newStream, MODE.PROXIMITY);
  }, [participants, props.roomId, user]);

  // ──────────────────────────────────────────────
  // INIT + EVENT SETUP
  // ──────────────────────────────────────────────
  useEffect(() => {
    registerSetMode(setMode);
    registerSetParticipants(setParticipants);
    registerSetUserNames(setUserNames);
    registerSetIsMeeting(setIsMeeting);
  }, []);

  useEffect(() => {
    if (orgRole) setUserRole(getUserRole());
  }, [orgRole]);

  // Load organization members
  useEffect(() => {
    const loadMembers = async () => {
      if (!organization?.getMemberships) return;
      try {
        const list = await organization.getMemberships();
        const arr =
          list?.data?.map((m: any) => ({
            id: m.publicUserData.userId,
            name:
              [m.publicUserData.firstName, m.publicUserData.lastName]
                .filter(Boolean)
                .join(" ") || m.publicUserData.username,
            role: m.role,
          })) || [];
        setMembers(arr);
      } catch (e) {
        console.error("Error loading members:", e);
      }
    };
    loadMembers();
  }, [organization]);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────
  return (
    <>
      {mode === MODE.PROXIMITY && (
        <>
          {participants.map((p) => (
            <audio
              key={p.id}
              playsInline
              autoPlay
              ref={(el) => {
  audioRefs.current[p.id] = el;
}}
            ></audio>
          ))}
          {userRole !== "member" && (
            <button
              onClick={handleStartMeeting}
              className="fixed bottom-24 right-4 z-[1100] px-5 py-3 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600"
            >
              <Video className="w-4 h-4 inline mr-1" />
              Start Meeting
            </button>
          )}
        </>
      )}

      {mode === MODE.MEETING && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex flex-col items-center justify-center">
          <video ref={myVideoRef} autoPlay muted playsInline className="w-1/2 rounded-lg" />
          <button
            onClick={handleLeaveMeeting}
            className="mt-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow"
          >
            <PhoneOff className="inline mr-2" />
            Leave Meeting
          </button>
        </div>
      )}
    </>
  );
}
