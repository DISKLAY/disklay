/* Create a small JPEG thumbnail before upload. Canvas removes image metadata. */
(function(root){
  'use strict';
  async function prepare(file){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('invalid_image');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=url;
      await image.decode();
      if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth>12000||image.naturalHeight>12000||image.naturalWidth*image.naturalHeight>24000000)throw Error('invalid_image');
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('invalid_image');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,160,160);
      const side=Math.min(image.naturalWidth,image.naturalHeight),x=(image.naturalWidth-side)/2,y=(image.naturalHeight-side)/2;
      ctx.drawImage(image,x,y,side,side,0,0,160,160);
      const output=canvas.toDataURL('image/jpeg',0.82);
      if(!output.startsWith('data:image/jpeg;base64,')||output.length>90023)throw Error('invalid_image');
      return output.slice('data:image/jpeg;base64,'.length);
    } finally {URL.revokeObjectURL(url);}
  }
  root.MedzoProfilePhoto={prepare};
})(window);
