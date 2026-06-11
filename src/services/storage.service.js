const ImageKit = require('imagekit');

const imagekitClient = new ImageKit({
    publicKey:process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey:process.env.IMAGEKIT_SECRET_KEY,
    urlEndpoint:process.env.IMAGEKIT_URL_ENDPOINT
})
async function uploadFile(file,fileName){
   const result= await imagekitClient.upload({
    file,
    fileName,
    folder:"spotify-project/music"
    
   })
return result;
}

module.exports={ uploadFile }