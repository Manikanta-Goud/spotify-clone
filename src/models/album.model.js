const mongoose =require('mongoose');

const albumSchema=new mongoose.Schema({

title:{
    type:String,
    required:true
},
musics:[{
    type:mongoose.Schema.Types.ObjectId,
    ref:"music",
    required:true,
}],
artist:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"users",
    required:true,
}
})

const albumModel=mongoose.model("album",albumSchema);

module.exports =albumModel;
