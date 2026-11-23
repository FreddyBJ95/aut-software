const finite=value=>typeof value==='number'&&Number.isFinite(value);

/** Screen presentation only: overview cuts stay compact while work/print keeps
 * the prominent full-size division symbol. The 44 px hit target is separate. */
export function jointMarkerPresentation(zoom,{interactive=true}={}){
 if(!interactive)return{scale:1,compact:false};
 const value=finite(zoom)&&zoom>0?zoom:1,scale=Math.max(.4,Math.min(1,value/2.5));
 return{scale,compact:scale<.9};
}
