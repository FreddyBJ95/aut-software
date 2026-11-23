import {t,language,locales} from './i18n.mjs?v=44';
const choices=[
 {id:'poppins',name:'Poppins'},
 {id:'roboto',name:'Roboto'},
 {id:'ibm-plex-sans',name:'IBM Plex Sans'},
 {id:'open-sans',name:'Open Sans'},
 {id:'source-sans-pro',name:'Source Sans Pro'},
 {id:'lato',name:'Lato'}
];
export function initTypography(refresh){
 const dialog=document.getElementById('font-dialog'),list=document.getElementById('font-options');let selected=null;
 try{const saved=localStorage.getItem('pipe-bend-font');if(choices.some(f=>f.id===saved))selected=saved;}catch{}
 function render(){list.replaceChildren();for(const font of choices){const b=document.createElement('button');b.type='button';b.className='font-option';b.style.fontFamily='"PB '+font.name+'", sans-serif';b.setAttribute('aria-pressed',String(selected===font.id));const name=document.createElement('strong'),sample=document.createElement('span'),digits=document.createElement('span');name.textContent=font.name;sample.className='font-sample';sample.textContent=t('Rør Ø22 mm · 45°');digits.className='font-digits';digits.textContent='0 O · 1 I · '+(1250.5).toLocaleString(locales[language])+' mm';b.append(name,sample,digits);b.onclick=async()=>{await document.fonts.load('16px "PB '+font.name+'"');selected=font.id;document.documentElement.style.setProperty('--app-font','"PB '+font.name+'", sans-serif');try{localStorage.setItem('pipe-bend-font',font.id);}catch{}render();refresh();dialog.close();};list.append(b);}}
 document.getElementById('font-open').onclick=()=>{render();dialog.showModal();};document.getElementById('font-close').onclick=()=>dialog.close();document.getElementById('language').addEventListener('change',render);
 if(selected){const font=choices.find(f=>f.id===selected);document.documentElement.style.setProperty('--app-font','"PB '+font.name+'", sans-serif');document.fonts.load('16px "PB '+font.name+'"').then(refresh).catch(()=>{});}
 render();
}
