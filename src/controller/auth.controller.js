const usermodel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');//for password hashing



async function register(req, res) {
    const { username, email, password, role = "user" } = req.body;


    //for checking if user already exists or not
    const isuserAlreadyExists = await usermodel.findOne({
        $or: [
            { username },
            { email }
        ]
    })

    if (isuserAlreadyExists) {
        return res.status(409).json({
            message: "user already exists"
        })
    }
    //for hashing the password we use bcrypt library
    //we use this then the password which is given by the user willl be converted into a well uiquw string 
    const hash = await bcrypt.hash(password, 10);
    //                                     |--> salt called salt generally it delays the attacker in case of hacking   
    console.log(hash);

    const user = await usermodel.create({
        username,
        email,
        password: hash,
        role
    })

    const token = jwt.sign({
        id: user._id,
        role: user.role

    }, process.env.TOKEN_SECRET)

    res.cookie("token", token)

    res.status(201).json({
        message: "user registered sucessfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    })
}

async function login(req, res) {
    const { username, email, password } = req.body;

    const user = await usermodel.findOne({
        $or: [
            { username },
            { email }
        ]
    })
    if (!user) {
        return res.status(409).json({
            message: "user not found"
        })
    }
    //compare user password with the database password those are hashed 
    const ispasswordcorrect = await bcrypt.compare(password, user.password);
    if (!ispasswordcorrect) {
        return res.status(409).json({
            message: "invalid credentials"
        })
    }
    const token = jwt.sign({
        id: user._id,
        role: user.role
    }, process.env.TOKEN_SECRET)

    res.cookie("token", token)

    res.status(200).json({
        message: "user logged sucessfuly",
        user: {
            username: user.username,
            email: user.email,
            role: user.role
        }
    })


}

async function logout(req, res) {
    res.clearCookie('token');
    res.status(200).json({
        message: "user logged out sucessfully"
    })
}


module.exports = { register, login, logout }