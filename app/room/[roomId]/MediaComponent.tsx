'use client'
import React, { useState,useEffect,useCallback,useRef, Ref, RefObject, CSSProperties } from "react";
import {MODE,ModeType,destroyRealtime,participantType,registerSetMode,setModeState,setStreamState,startSignaling,RTCEventEmitter,registerSetParticipants,
        broadcastModeChange,broadCastUserNames,setCurrentStateName,registerSetUserNames,broadcastMeetingState,registerSetIsMeeting,
        sendMeetingInvite,getMyId,registerSetShowInviteNotification,renegotiate,handleMute,getSelfId
    } from "../../../game/realtime/PlayerRealtime"
import { useUser,useAuth } from '@clerk/nextjs';
import LeaveRoomButton from './LeaveRoomButton';
import { Button } from "@/components/ui/button";
import { error } from "console";
// Math from phaser conflicts with native Math, using native Math directly
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { Span } from "next/dist/trace";
import {Init , participantDataType,setNewParticipantServerAction,setParticipantBlobChunk,setParticipantOffset,stopMeeting,stopRecorder,type MeetingSummary, saveMeetingSummary

} from "./../../actions/Summary"
import { set } from "react-hook-form";
import { CollaborativeWhiteboardProps } from "@/components/CollaborativeWhiteboard";
import { Video } from "lucide-react";

const CSS:CSSProperties={
    position:"absolute",top:"50%",left:"50%",
    backgroundColor:"black",
    width:"90%",height:"80%",
    display:"flex",
    transform:"translate(-50%,-50%)"
}
type propType={
    handleOpenWhiteboard:()=>void,
    set:React.Dispatch<React.SetStateAction<boolean>>,
    children:React.ReactNode,
    isWhiteboardOpen:boolean,
    roomId:string
}

export default function  MediaComponent(props:propType){
    
    const { orgRole } = useAuth();
    const { user, isLoaded } = useUser();

    const getUserRole = (): string => {
        if (!orgRole) return 'member';
        return orgRole.replace('org:', '');
    };

    const audioRefs=useRef<{[id:string]:HTMLAudioElement | null}>({});
    const myVideoRef=useRef<HTMLVideoElement | null>(null);
    const videoRefs=useRef<{[id:string]:HTMLVideoElement | null}>({});
    const hasSentMessage = useRef(false);
    const recorder=useRef<MediaRecorder | null>(null);
    const currentParticipantIdRef=useRef<string | null>(null); // Store participant ID to prevent it from changing

    const [myStream,setMyStream]=useState<MediaStream | null>(null)
    const [mode,setMode]=useState<ModeType>(MODE.PROXIMITY) // proximity | meeting
    const [participants,setParticipants]=useState<participantType[]>([]);
    const [userRole,setUserRole]=useState<string>(getUserRole()) // admin | team_manager | member
    const [userNames,setUserNames]= useState<{[id:string]:string}>({})
    const [isMeeting,setIsMeeting]=useState<boolean>(false)
    const [showInviteNotification,setShowInviteNotification]=useState<boolean>(false)
    const [isMuted,setIsMuted]=useState<boolean>(false)
    
    
    function updateMode(m:ModeType){
        setMode(m);
        setModeState(m)
    }
    function updateMyStream(s:MediaStream){
        setMyStream(s)
        setStreamState(s)
    }

    const getUserMediaInit = useCallback(()=>{
        navigator.mediaDevices.getUserMedia({audio:true})
        .then((s)=>{
            updateMyStream(s)
            startSignaling()
        })
        .catch((e)=>{console.error("Failed in getUserMedia()\n\n"+e)})
    },[])

    async function getUserMedia(c:{video:boolean,audio:boolean}){
        try{
            const newStream=await navigator.mediaDevices.getUserMedia({audio:c.audio,video:c.video,})
            updateMyStream(newStream);
            return newStream;

        }catch(e){throw new Error(""+e)}
    } 
    const handleRecorder=useCallback(async (s:MediaStream)=>{
        // Filter to only audio tracks to reduce blob size
        const audioTracks = s.getAudioTracks();
        if(audioTracks.length === 0){
            console.error("No audio tracks in stream");
            return;
        }
        
        // Create new stream with only audio tracks
        const audioOnlyStream = new MediaStream(audioTracks);
        
        // Get and store participant ID at the start - capture it in closure
        const participantId = getSelfId();
        if(!participantId || participantId === "notSet"){
            console.error("Invalid participant ID:", participantId);
            return;
        }
        
        // Store in ref for debugging, but use the closure variable for actual operations
        currentParticipantIdRef.current = participantId;
        
        // Log the ID we're using
        console.log(`[${participantId}] Starting recorder. getSelfId() returned:`, participantId);
        console.log(`[${participantId}] This ID will be used for all chunks and stopRecorder`);
        
        const n:participantDataType={
            id: participantId, // Use the captured participantId
            offset:Date.now(),
            chunks:[],
            isFinished:false
        }
        
        console.log(`[${participantId}] Participant data created with ID: ${n.id}`);
        
        // Set participant BEFORE creating recorder
        await setNewParticipantServerAction(n);
        
        // Log that participant was set
        console.log(`[${participantId}] ✅ Participant set with ID: ${n.id}`);
        
        // Use audio-only stream for recording
        recorder.current = new MediaRecorder(audioOnlyStream, {
            mimeType: 'audio/webm;codecs=opus' // Use opus codec for better compression
        });
        
        recorder.current.start(2500); // 2.5 second chunks
        
        // IMPORTANT: Use the captured participantId from closure, not from ref or getSelfId()
        // This ensures the same ID is used throughout the recording lifecycle
        const recordingParticipantId = participantId;
        
        recorder.current.ondataavailable = async (e) => {
            if(e.data && e.data.size > 0){
                // ALWAYS use the captured participantId from closure
                const currentGetSelfId = getSelfId();
                console.log(`[${recordingParticipantId}] Data available: ${e.data.size} bytes`);
                console.log(`[${recordingParticipantId}] Using ID: ${recordingParticipantId}, getSelfId() now: ${currentGetSelfId}`);
                
                if(recordingParticipantId !== currentGetSelfId){
                    console.warn(`[${recordingParticipantId}] ⚠️ ID mismatch! Using captured ID: ${recordingParticipantId}, getSelfId() returned: ${currentGetSelfId}`);
                }
                
                await setParticipantBlobChunk(recordingParticipantId, e.data).catch((error) => {
                    console.error(`[${recordingParticipantId}] Error setting participant blob chunk:`, error);
                });
            }
        }
        
        recorder.current.onstop = async () => {
            // ALWAYS use the captured participantId from closure
            const currentGetSelfId = getSelfId();
            console.log(`[${recordingParticipantId}] Recorder stopped`);
            console.log(`[${recordingParticipantId}] Using ID: ${recordingParticipantId}, getSelfId() now: ${currentGetSelfId}`);
            
            if(recordingParticipantId !== currentGetSelfId){
                console.warn(`[${recordingParticipantId}] ⚠️ ID mismatch! Using captured ID: ${recordingParticipantId}, getSelfId() returned: ${currentGetSelfId}`);
            }
            
            const result = await stopRecorder(recordingParticipantId, Date.now());
            if(result){
                console.log(`[${recordingParticipantId}] Transcription result:`, result.text?.substring(0, 100));
            } else {
                console.error(`[${recordingParticipantId}] stopRecorder returned null`);
            }
            // Clear the ref when done
            currentParticipantIdRef.current = null;
        }
    },[recorder])
    const handleStartMeeting=useCallback(async ()=>{
        await Init(Date.now());
        const newStream:MediaStream=await getUserMedia({audio:true,video:true});
       await handleRecorder(newStream);

        updateMode(MODE.MEETING)
        broadcastModeChange(MODE.MEETING)
        broadcastMeetingState(true)
        props.set(true)
        setIsMeeting(true)
        renegotiate(newStream,MODE.MEETING);
        
    },[])
    const handleJoinMeeting=useCallback(async ()=>{
        const newStream:MediaStream=await getUserMedia({audio:true,video:true});
        await handleRecorder(newStream)
        updateMode(MODE.MEETING)
        broadcastModeChange(MODE.MEETING)
        props.set(true)
        setIsMeeting(true)
        renegotiate(newStream,MODE.MEETING);
    },[])
    const handleLeaveMeeting=useCallback(async ()=>{
        recorder.current?.stop();
       
        const newStream : MediaStream= await getUserMedia({audio:true,video:false})
        updateMode(MODE.PROXIMITY)
        broadcastModeChange(MODE.PROXIMITY)
        let isPresent=false;
        participants.forEach((p)=>{
            if(p.mode===MODE.MEETING){
                isPresent=true
            }
        })
        if(isPresent){
          
        }
        else{
          
            broadcastMeetingState(false);
           
            stopMeeting(props.roomId).then((summary: MeetingSummary | null) => {
                if (summary) {
                    console.log("Meeting Summary:", summary.summary);
                    console.log("Key Points:", summary.keyPoints);
                    console.log("Participants:", summary.participants);
                    const durationMinutes = summary.duration / 60000;
                    console.log("Duration:", Math.floor(durationMinutes) as number, "minutes");
                    // Save to Supabase
                    saveMeetingSummary(summary, props.roomId).catch((error) => {
                        console.error("Error saving meeting summary:", error);
                    });
                }
            }).catch((error) => {
                console.error("Error generating meeting summary:", error);
            });
        }
        props.set(false)
        renegotiate(newStream,MODE.PROXIMITY);

    },[participants, props.roomId])

    const handleInvite=useCallback((participantId: string)=>{
        sendMeetingInvite(participantId);
    }, [])
    
    const handleAcceptInvite=useCallback(async ()=>{
        setShowInviteNotification(false);
        await handleJoinMeeting();
    },[])
    
    const handleRejectInvite=useCallback(()=>{
        setShowInviteNotification(false);
    },[])

    const registerEvents = useCallback(()=>{
        RTCEventEmitter.removeAllListeners("onTrack")
        RTCEventEmitter.on("onTrack",(from:string,track:MediaStreamTrack,mode:ModeType)=>{
           
                setParticipants((prev)=>{
                    let isPresent=false;
                    prev.forEach((p)=>{
                        if(p.id===from){
                            isPresent=true;
                            p.stream=new MediaStream([track])
                        }
                    })
                    if(isPresent){
                        return [...prev]
                    }
                    else{
                         let newParticipant:participantType={id:from,mode:mode,stream:new MediaStream([track])}
                         return [...prev,newParticipant]
                    }
                })
        })
        RTCEventEmitter.removeAllListeners("onMeetingTrack")
        RTCEventEmitter.on("onMeetingTrack",(from:string,track:MediaStreamTrack,mode:ModeType,flag:boolean)=>{
           console.log("\n\n\wrfwn\n\n\nhiiiiiiiii\n\n\n\n\n\nfwf\n\n\n")
                setParticipants((prev)=>{
                    let isPresent=false;
                    prev.forEach((p)=>{
                        if(p.id===from){
                            isPresent=true;
                            if(!flag){
                                p.stream=new MediaStream([track])
                            }
                            else{
                                if(p.stream && p.stream.getTracks().length===1){
                                    p.stream.addTrack(track)
                                }
                            }
                        }
                    })
                    return [...prev]
                })
        })
        RTCEventEmitter.removeAllListeners("onParticipant");
        RTCEventEmitter.on("onParticipant",(participant:participantType)=>{
            setParticipants((prev)=>{

                let isPresent=false;  
                prev.forEach((p)=>{
                    if(p.id===participant.id){
                        isPresent=true;
                    }
                })
                if(isPresent){
                    return prev
                }
                else{
                    return [...prev,participant]
                }
            })      
        })
    },[])

    


    useEffect(()=>{
        registerSetMode(setMode)
        registerSetParticipants(setParticipants)
        registerSetUserNames(setUserNames)
        registerSetIsMeeting(setIsMeeting)
        registerSetShowInviteNotification(setShowInviteNotification)

        getUserMediaInit();
        registerEvents()

        return ()=>{
            registerSetMode(null);
            registerSetParticipants(null)
            registerSetUserNames(null)
            registerSetIsMeeting(null)
            registerSetShowInviteNotification(null)
            RTCEventEmitter.removeAllListeners()
            recorder.current=null
        }
   },[])

    useEffect(() => {
        const role = getUserRole();
        setUserRole(role);
        console.log("orgRole:", orgRole, "userRole:", role);
    }, [orgRole]);
    useEffect(() => {
        if (isLoaded && user && !hasSentMessage.current) {
            const name = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || '';
            registerSetUserNames(setUserNames)
            setCurrentStateName(name)
            broadCastUserNames(name)
            hasSentMessage.current=true;
        
        }
    }, [isLoaded, user]);

    useEffect(()=>{
        if(mode===MODE.PROXIMITY){
        participants.forEach((p)=>{
            if(p.mode!==MODE.PROXIMITY){
                return
            }
            const element=audioRefs.current[p.id];
            if(!element){throw new Error("AUDIO ELEMENT is null in mediacompionent.tsx ")}
            else{

                element.srcObject=p.stream
            }
           
        })
        }
        else if(mode===MODE.MEETING){
            participants.forEach((p)=>{
                if(p.mode!==MODE.MEETING){return;}
                const element=videoRefs.current[p.id];
                if(!element){throw new Error("AUDIO ELEMENT is null in mediacompionent.tsx ")}
                else{
                    element.srcObject=p.stream
                }
            })
            const element=myVideoRef.current
                if(!element){throw new Error("AUDIO ELEMENT is null in mediacompionent.tsx ")}
                else{
                    element.srcObject=myStream
                }
        }
        console.log("\n\n\n\n\\n\n\n\n\\n\n\n\n\n\n\n\n\n"+participants.length+"\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n")
    },[participants,mode])

  
    


 
    
    return<>
    {props.isWhiteboardOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 120050 }}>
            {props.children}
        </div>
    )}
    
    {/* Meeting Invite Notification */}
    {showInviteNotification && mode!==MODE.MEETING && (
        <div style={{
            position:"fixed",
            top:"2rem",
            right:"2rem",
            zIndex:2000,
            padding:"1.25rem",
            backgroundColor:"rgba(15, 23, 42, 0.95)",
            backdropFilter:"blur(8px)",
            borderRadius:"0.75rem",
            border:"1px solid rgba(148, 163, 184, 0.15)",
            boxShadow:"0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            minWidth:"320px",
            maxWidth:"400px"
        }}>
            <div style={{
                display:"flex",
                flexDirection:"column",
                gap:"1rem"
            }}>
                <p style={{
                    color:"rgba(241, 245, 249, 0.95)",
                    fontSize:"0.875rem",
                    margin:0
                }}>
                    You have been invited to a meeting
                </p>
                <div style={{
                    display:"flex",
                    gap:"0.75rem",
                    justifyContent:"flex-end"
                }}>
                    <button
                        onClick={handleRejectInvite}
                        style={{
                            padding:"0.5rem 1rem",
                            backgroundColor:"rgba(71, 85, 105, 0.6)",
                            color:"rgba(241, 245, 249, 0.9)",
                            border:"1px solid rgba(148, 163, 184, 0.2)",
                            borderRadius:"0.5rem",
                            fontSize:"0.875rem",
                            fontWeight:"500",
                            cursor:"pointer",
                            transition:"all 0.2s ease-in-out"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(71, 85, 105, 0.8)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(71, 85, 105, 0.6)";
                        }}
                    >Reject</button>
                    <button
                        onClick={handleAcceptInvite}
                        style={{
                            padding:"0.5rem 1rem",
                            backgroundColor:"rgba(99, 102, 241, 0.8)",
                            color:"white",
                            border:"none",
                            borderRadius:"0.5rem",
                            fontSize:"0.875rem",
                            fontWeight:"500",
                            cursor:"pointer",
                            transition:"all 0.2s ease-in-out"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 1)";
                            e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.8)";
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >Accept</button>
                </div>
            </div>
        </div>
    )}
        



{/*#############################################################################################################################################################################################################

-----------------------------------------------------------------------------PROXIMITY--------------------------------------------------------------------------------------------------------------------------

################################################################################################################################################################################################################
*/}

    {mode===MODE.PROXIMITY && 
        <>
            {participants.map((participant)=>{
                if(participant.mode!==MODE.PROXIMITY){return}
                return <audio 
                    playsInline
                    autoPlay
                    key={participant.id}
                    ref={(element)=>{audioRefs.current[participant.id]=element}}
                    className={"AudioElement"+participant.id}
                ></audio>
            })}
            {userRole!=="member" && !isMeeting && 
             <button
                className="fixed bottom-24 right-4 z-[1100] inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 md:bottom-28 md:right-6"
                onClick={async(e)=>{await handleStartMeeting()}}
            >Start Meeting</button>
            }
        </>
    }
   



{/*#############################################################################           MEETING             ################################################################################################*/}


        {mode===MODE.MEETING && 
            <>
                <div className="fixed inset-0 z-[1001] flex flex-col gap-6 bg-slate-950/90 pl-6 pr-0 py-6 backdrop-blur-2xl md:pl-10 md:pr-0 md:py-10">
                    <div className="container grid w-full flex-1 grid-cols-[repeat(auto-fit,minmax(30rem,30rem))] justify-start gap-4 overflow-y-auto pr-2">
                        <div className="video_wrapper relative h-[360px] w-[480px] overflow-hidden rounded-xl bg-slate-900/80 shadow-lg shadow-black/40">
                            <video 
                                playsInline
                                autoPlay
                                className="MyVideo absolute inset-0 h-full w-full bg-slate-900 object-cover"
                                ref={myVideoRef}
                                muted
                            ></video>
                        </div>
                       
                        {participants.map((participant,i)=>{
                            if(participant.mode!==MODE.MEETING){return;}
                            return <React.Fragment key={participant.id}>
                                <div className="video_wrapper relative h-[360px] w-[480px] overflow-hidden rounded-xl bg-slate-900/80 shadow-lg shadow-black/40">
                                    <video 
                                        playsInline
                                        autoPlay
                                        className={"absolute inset-0 h-full w-full bg-slate-900 object-cover Vide aoElement"+participant.id}
                                        ref={(element)=>{videoRefs.current[participant.id]=element}}
                                    ></video>
                                </div>
                            </React.Fragment>
                        })}
                    </div>
                    <div className="Panel" 
                    style={{
                        position:"absolute",
                        right:"0.2%",
                        top:"1.5rem",
                        padding:"1rem",
                        backgroundColor:"rgba(15, 23, 42, 0.95)",
                        backdropFilter:"blur(8px)",
                        display:"flex",
                        flexDirection:"column",
                        width:"15%",
                        minWidth:"200px",
                        gap:"0.75rem",
                        borderRadius:"0.75rem",
                        border:"1px solid rgba(148, 163, 184, 0.1)",
                        boxShadow:"0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
                        height:"fit-content",
                        maxHeight:"calc(100% - 3rem)",
                        overflowY:"auto",
                        overflowX:"hidden"
                    }}>
                        {participants.length===0 && (
                            <div style={{
                                display:"flex",
                                alignItems:"center",
                                justifyContent:"center",
                                padding:"2rem 1rem",
                                color:"rgba(148, 163, 184, 0.7)",
                                fontSize:"0.875rem",
                                fontWeight:"400",
                                textAlign:"center",
                                width:"100%"
                            }}>
                                No Participants Currently
                            </div>
                        )}
                        {participants.map((p)=>{
                            
                            let u=userNames[p.id];

                            return <React.Fragment key={p.id+"Names"}>
                                <div  className="participantHolder" style={{
                                    display:"flex",
                                    alignItems:"center",
                                    justifyContent:"space-between",
                                    padding:"0.75rem 1rem",
                                    backgroundColor:"rgba(30, 41, 59, 0.6)",
                                    borderRadius:"0.5rem",
                                    border:"1px solid rgba(148, 163, 184, 0.15)",
                                    transition:"all 0.2s ease-in-out",
                                    gap:"0.75rem",
                                    minHeight:"3rem"
                                }}>
                                    <span style={{
                                        color:"rgba(241, 245, 249, 0.95)",
                                        fontSize:"0.875rem",
                                        fontWeight:"500",
                                        letterSpacing:"0.025em",
                                        flex:"1",
                                        overflow:"hidden",
                                        textOverflow:"ellipsis",
                                        whiteSpace:"nowrap"
                                    }}>{u || "Unknown User"}</span>
                                    {userRole!=="member"?
                                     <button 
                                        disabled={p.mode===MODE.MEETING}
                                        onClick={()=>{handleInvite(p.id)}}
                                        style={{
                                            padding:"0.375rem 0.75rem",
                                            backgroundColor:p.mode===MODE.MEETING ? "rgba(71, 85, 105, 0.5)" : "rgba(99, 102, 241, 0.8)",
                                            color:p.mode===MODE.MEETING ? "rgba(148, 163, 184, 0.6)" : "white",
                                            border:"none",
                                            borderRadius:"0.375rem",
                                            fontSize:"0.75rem",
                                            fontWeight:"500",
                                            cursor:p.mode===MODE.MEETING ? "not-allowed" : "pointer",
                                            transition:"all 0.2s ease-in-out",
                                            whiteSpace:"nowrap",
                                            flexShrink:"0",
                                            opacity:p.mode===MODE.MEETING ? 0.6 : 1
                                        }}
                                        onMouseEnter={(e) => {
                                            if (p.mode !== MODE.MEETING) {
                                                e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 1)";
                                                e.currentTarget.style.transform = "scale(1.05)";
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (p.mode !== MODE.MEETING) {
                                                e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.8)";
                                                e.currentTarget.style.transform = "scale(1)";
                                            }
                                        }}
                                    >Invite</button>:
                                    <div style={{
                                        padding:"0.375rem 0.75rem",
                                        backgroundColor:p.mode===MODE.MEETING ? "rgba(34, 197, 94, 0.2)" : "rgba(71, 85, 105, 0.4)",
                                        color:p.mode===MODE.MEETING ? "rgba(34, 197, 94, 0.9)" : "rgba(148, 163, 184, 0.7)",
                                        border:"1px solid",
                                        borderColor:p.mode===MODE.MEETING ? "rgba(34, 197, 94, 0.3)" : "rgba(148, 163, 184, 0.2)",
                                        borderRadius:"0.375rem",
                                        fontSize:"0.75rem",
                                        fontWeight:"500",
                                        whiteSpace:"nowrap",
                                        flexShrink:"0",
                                        display:"flex",
                                        alignItems:"center",
                                        justifyContent:"center"
                                    }}>
                                        {p.mode===MODE.MEETING ? "In Meeting" : "Available"}
                                    </div>}
                                </div>
                            </React.Fragment>
                        })}
                    </div>
                    
                    <div className="mt-auto flex flex-row items-center justify-center gap-3 pb-2">
                        <button 
                            style={{
                                width:"3rem",
                                height:"3rem",
                                borderRadius:"50%",
                                backgroundColor:isMuted ? "rgba(239, 68, 68, 0.8)" : "rgba(71, 85, 105, 0.8)",
                                border:"1px solid",
                                borderColor:isMuted ? "rgba(220, 38, 38, 0.3)" : "rgba(148, 163, 184, 0.2)",
                                display:"flex",
                                alignItems:"center",
                                justifyContent:"center",
                                cursor:"pointer",
                                transition:"all 0.2s ease-in-out",
                                color:"rgba(241, 245, 249, 0.9)",
                                boxShadow:"0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
                            }}
                            onClick={() => {
                                setIsMuted(!isMuted);
                                handleMute(!isMuted);
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isMuted ? "rgba(220, 38, 38, 1)" : "rgba(71, 85, 105, 1)";
                                e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isMuted ? "rgba(239, 68, 68, 0.8)" : "rgba(71, 85, 105, 0.8)";
                                e.currentTarget.style.transform = "scale(1)";
                            }}
                        >
                            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                        <button
                         style={{
                            width:"3rem",
                            height:"3rem",
                            borderRadius:"0.75rem",
                            backgroundColor:"rgba(239, 68, 68, 0.9)",
                            border:"1px solid rgba(220, 38, 38, 0.3)",
                            color:"white",
                            display:"flex",
                            alignItems:"center",
                            justifyContent:"center",
                            cursor:"pointer",
                            transition:"all 0.2s ease-in-out",
                            boxShadow:"0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
                         }}
                         onClick={(e)=>{handleLeaveMeeting()}}
                         onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 1)";
                            e.currentTarget.style.transform = "scale(1.05)";
                            e.currentTarget.style.boxShadow = "0 6px 8px -1px rgba(0, 0, 0, 0.4), 0 4px 6px -1px rgba(0, 0, 0, 0.3)";
                         }}
                         onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.9)";
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)";
                         }}
                         >
                            <PhoneOff size={20} />
                         </button>
                    </div>
                </div>

            </>
        }
    </>
}