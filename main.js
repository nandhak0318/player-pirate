import './style.css'
import './plyr.css'
import Plyr from 'plyr';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile,toBlobURL } from '@ffmpeg/util';
import toWebVTT from "srt-webvtt";
import axios from 'axios';



// constants
// const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
const baseURL = '/ffmpeg'

const maxAllowedSize = (1024*2) * 1024 * 1024;
const RANDOM_LANGS = [
  "en", // English
  "fr", // French
  "es", // Spanish
  "de", // German
  "zh", // Chinese
  "ja", // Japanese
  "ko", // Korean
  "ru", // Russian
  "ar", // Arabic
  "pt", // Portuguese
  "it", // Italian
  "hi", // Hindi
  "nl", // Dutch
  "tr", // Turkish
  "pl", // Polish
  "sv", // Swedish
  "cs", // Czech
  "fi", // Finnish
  "el", // Greek
  "da"  // Danish
]

// globals
const ffmpeg = new FFmpeg();
let mouseIsDown = false
let morespeed = false
let saver
let fname
let currentMovie
let boostVolume =1

// 
if(!('AudioContext' in window || 'webkitAudioContext' in window)){
  document.getElementById('boost-sup').classList.remove('hide')
  document.getElementById('slider').disabled = true
}

if (!SharedArrayBuffer) document.getElementById('shared').classList.remove('hide')

// initationg
let source_config = {
  type: 'video',
  title: fname,
  sources:[
  
  ],
  tracks:[]
}
if(!localStorage.getItem('time')){
  localStorage.setItem('time',JSON.stringify({}))
}

const player = new Plyr('#player',{
  keyboard:{global:true},settings:["captions", "quality", "speed", "loop"] ,captions:{active:true,language:'auto',update:true},tooltips:{controls:true,seek:true},controls: [
    'play-large',
    'restart', 
    'rewind', 
    'play', 
    'fast-forward', 
    'progress', 
    'current-time', 
    'duration', 
    'mute',
    'volume',
    'captions',
    'settings',
    'pip', 
    'airplay',
    // 'download',
    'fullscreen',
  ],
});

//  video player
document.getElementById('movie').addEventListener('change',()=>{
  const fileInput = document.getElementById('movie');
  if (fileInput.files.length > 0) {
    load(fileInput.files[0]);
  } else {
    console.error('No file selected.');
  }
})

const load = async(files)=>{
  if(currentMovie){
    URL.revokeObjectURL(currentMovie);
    currentMovie = null
  }
  source_config.sources=[]
  source_config.tracks=[]
  if(saver){
    clearInterval(saver)
  }
  fname = files.name
  currentMovie = URL.createObjectURL(files);

  source_config.sources = [
    {
      src: currentMovie,
      type: 'video/mp4',
      size: 720,
    }
  ]
  

  // check ffmpeg processing
  if (files.size < maxAllowedSize && SharedArrayBuffer){
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
       workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
    });
  
    console.log('write')
    await ffmpeg.writeFile(fname, await fetchFile(files));
    console.log('exec')
    // ffmpeg -i movie.mkv -vn -an -codec:s:0 srt movie.srt
    // await ffmpeg.exec(['-i', name,'-vn','-an','-codec:s:0','srt', 'subs.srt']);
    await ffmpeg.exec(['-i', fname, '-vn', '-an', '-c:s', 'copy', 'subs_%d.srt']);
    // await ffmpeg.exec(['-i',name,'subs.srt'])
    console.log('getch')

    let list = await ffmpeg.listDir('/')
    console.log(list)
    let found = list.find((i)=>i.name=='subs_%d.srt')
    if(found?.name) {
      let data  =  await ffmpeg.readFile('subs_%d.srt') 
      let  bob = new Blob([data], { type: 'text/plain' });
      let subUrl = await toWebVTT(bob)
      source_config.tracks = [
        {
          kind: 'captions',
          label: 'English',
          srclang: 'en',
          src: subUrl,
          default: true,
        }
      ]
    }
  }else{
    if(SharedArrayBuffer) document.getElementById('large-file').classList.remove('hide')
  }
 
  player.source = source_config

  loadExtras()
  saveDuration()
}
  
function saveDuration(){
  // saving current time
  let recent = JSON.parse(localStorage.getItem('time'))
  let tempdur
  
  if(recent[fname]){
   tempdur = recent[fname].duration
  //  play seek and pause
   player.play()

   setTimeout(()=>{
    player.currentTime = tempdur
    player.pause()
  },200)

  }

  saver = setInterval(()=>{
    let load = {duration: player.currentTime}
    let current = JSON.parse(localStorage.getItem('time'))
    current[fname] = load
    localStorage.setItem('time',JSON.stringify(current))
  },1000)

}

function loadExtras(){

  // click and hold to fast forward
  document.getElementsByClassName('plyr__poster')[0].addEventListener('mousedown',()=>{
    mouseIsDown = true
    setTimeout(function() {
      if(mouseIsDown) {
        player.speed = 2
        morespeed = true
        player.play()
      }
    }, 1000);
  })

  document.getElementsByClassName('plyr__poster')[0].addEventListener('mouseup', function() {
    mouseIsDown = false;
    if(morespeed){
     setTimeout(()=>player.play(),10)
      morespeed=false
    }
    player.speed = 1
  });
}


function downloadBlob(blob){
const downloadLink = document.createElement('a');
downloadLink.href =  blob;
downloadLink.download = 'subtitles.srt';
document.body.appendChild(downloadLink);
downloadLink.click();
document.body.removeChild(downloadLink);
}


// subtitle
document.getElementById('add-sub').addEventListener('change',()=>{
  const fileInput = document.getElementById('add-sub');
  if (fileInput.files.length > 0) {
    addSub(fileInput.files[0]);
  } else {
    console.error('No file selected.');
  }
})

async function addSub(data){
  let subUrl = await toWebVTT(data)
  let num  = source_config.tracks.length +1 || 1
  let lang = RANDOM_LANGS[source_config.tracks.length +1] || 'bro'
  source_config.tracks.push({
          kind: 'captions',
          label: `user-${num}`,
          srclang: lang,
          src: subUrl,
  })
  console.log(data,subUrl)
  player.source = source_config
  saveDuration()
}

document.getElementById('slider').addEventListener('change',(e)=>{
  boostVolume = e.target.value
  Boost()
})

function Boost() {
  if(!window.boosterGainNode) {
      const video = document.querySelector('video');
      const audioCtx = new AudioContext();
      const mediaSource = audioCtx.createMediaElementSource(video);
      const gainNode = audioCtx.createGain();
      mediaSource.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      window.boosterGainNode = gainNode;
  }
  window.boosterGainNode.gain.value = boostVolume;
}


document.getElementById('add-dly').addEventListener('click',(e)=>{
  e.preventDefault()
  let value = document.getElementById('delay').value
  addOffset(value)
})


function addOffset (offset) {
  offset = parseInt(offset)
  const video = document.querySelector('video');
  if (video) {

    Array.from(video.textTracks).forEach((track) => {
        Array.from(track.cues).forEach((cue) => {
          cue.startTime += offset || 0.5;
          cue.endTime += offset || 0.5;
        });
    });
    return true;
  }
  return false;
}