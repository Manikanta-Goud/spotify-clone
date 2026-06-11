const musicmodel=require('../models/music.model');
const jwt=require('jsonwebtoken');
const  { uploadFile } =require('../services/storage.service');
const albumModel=require('../models/album.model');

//for creating music we need to give the title of the music and also the music file which is in the form of buffer and also the artist of that music
async function createMusic(req,res){
    

    const { title }=req.body;
    const file =req.file;

    const result=await uploadFile(file.buffer, file.originalname)

    const music=await musicmodel.create({
        uri:result.url,
        title,
        artist:req.user.id


    })
    res.status(201).json({
        message:"music created sucessfullly",
        music:{
            id:music._id,
            uri:music.uri,
            title:music.title,
            artist:music.artist
        }
    })
}

//for creating album we need to give the title of the album and musics which are in that album and also the artist of that album
async function createAlbum(req,res){

        const {title,musics} = req.body;
        const album=await albumModel.create({
            title,
            artist:req.user.id,
            musics:musics
})
res.status(201).json({
    message:"album created sucessfully",
    album:{
        id:album._id,
        title:album.title,
        artist:album.artist,
        musics:album.musics,
    }
})


}

//generally find method gets all the musics from database if they were around 2 to 3 million 
//suppose then server can be crashed so to overcome this we use limit method
async function findAllMusics(req,res){
    const musics=await musicmodel
    .find()
    .skip(1)//it will skip one song and gives second song
    .limit(10)//what it does means it will fetch only 10 musics from the database
    .populate("artist","username email");

    res.status(200).json({
        message:"all musics fetched sucessfully",
        musics:musics
    })

}

//for seeing all albums with their artist details and music details we use populate method
async function albums(req,res){
    const albums=await albumModel.find().select("title artist").populate("artist","username email")

    
    res.status(200).json({
        message:"all albums fetched sucessfully",
        albums:albums
    })
}
//finding all the musics by album id with the help of populate method
async function albumbyID(req,res){
    const albumid=req.params.id;
    
    const album=await albumModel.findById(albumid).populate("artist","username email").populate("musics","title uri")

    
     return  res.status(200).json({
        message:"album found",
        album:album
    })

}


module.exports={ createMusic,createAlbum ,findAllMusics, albums ,albumbyID } 
