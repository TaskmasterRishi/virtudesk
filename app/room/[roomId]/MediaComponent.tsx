'use client'
import { useState,useEffect,useCallback,useRef, Ref, RefObject } from "react";
import {createOffer, setSTREAM,setMediaElement, MediaComponentTtype,RTCEventEmitter} from "../../../game/realtime/PlayerRealtime"
type Constraints = {
    audio:boolean,
    video:boolean
}


export default function  MediaComponent(){
    
    const [stream,setStream] = useState<MediaStream|undefined>(undefined);
    const [constraints,setConstraints]=useState<Constraints>({audio:true,video:true})
    const MediaElementRef=useRef<(HTMLMediaElement | null )[]>([])
    const [participants,setParticipants]=useState<MediaComponentTtype[]>([] as MediaComponentTtype[])
    const requestMedia= useCallback(async (a:boolean=true,v:boolean=false)=>{

        const myStream =await  navigator.mediaDevices.getUserMedia({audio:a,video:v})
        setConstraints({audio:a,video:v});
        setStream(myStream);
        setSTREAM(myStream)
        
    },[])
   
    const MediaRef=new Map<string,MediaStream>()
        participants.forEach((participant)=>{
            MediaRef.set(participant.from,participant.track)
            
        })
    
        useEffect(()=>{
            setMediaElement(setParticipants)
            if(!stream){
                 requestMedia(true,false);
                console.log("mediacomponent mounted");
            }
      
        return ()=>{
            stream?.getTracks().forEach((track) => {
                    track.stop();
                    console.log("goneeee")
            });
            RTCEventEmitter.removeAllListeners("onTrack")
            setParticipants([])
            console.log("mediacomponent unmounted")
        }
    },[])
   useEffect(()=>{
      participants.map((participant,index)=>{
                const el:HTMLMediaElement=document.getElementById("myAudio"+index)as HTMLMediaElement;
                const arr=document.querySelectorAll(".myAudio")
                console.log(arr)
                el.srcObject=participant.track;
                el.volume=1
                if(el){
                    console.log("ELEMENT EXIST")
                    el.play().catch(()=>{console.error("not playing")})
                    console.log(el.srcObject)
                }

            })
   },[participants])
      
        return<>
            <button style={{height:"50px",width:"50px",backgroundColor:"white",display:"block"}} onClick={()=>{
                MediaElementRef.current.forEach( (r)=>{ r?.play().then((val)=>{console.log("is playing")})})
                }}></button>
            {participants.map((participant,index)=>{
                console.log(participant,RTCEventEmitter.listenerCount("onTrack"))
                if(MediaElementRef.current[index]){
                    MediaElementRef.current[index].srcObject=participant.track;
                    console.log("Element exist")
                }
                 MediaElementRef.current[index]?.play()
                return <>
                    
                    <audio className="myAudio" id={"myAudio"+index} key={participant.from} ref={(e)=>{MediaElementRef.current[index]=e}}  playsInline autoPlay />
                </>
            })}
        </>
    
}