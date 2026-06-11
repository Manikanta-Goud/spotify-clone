const express=require('express');
const authcontroller=require('../controller/auth.controller');
const router=express.Router();

router.post('/register',authcontroller.register);
router.post('/login',authcontroller.login)
router.post('/logout',authcontroller.logout)
module.exports=router;