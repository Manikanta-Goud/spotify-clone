const express=require('express');
const musiccontroller=require('../controller/music.controller');
const multer=require('multer');
const router=express.Router();
const authMiddleware=require('../middleware/auth.middleware');

const upload=multer({
    storage:multer.memoryStorage()
})

router.post('/upload',authMiddleware.authVerify,upload.single('music'),musiccontroller.createMusic); 
router.post('/album',authMiddleware.authVerify,musiccontroller.createAlbum);
router.get('/allsongs',authMiddleware.authUser,musiccontroller.findAllMusics);
router.get('/albums',authMiddleware.authUser,musiccontroller.albums)
router.get('/album/:id',authMiddleware.authUser,musiccontroller.albumbyID);
module.exports= router;