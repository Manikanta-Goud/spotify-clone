const jwt=require('jsonwebtoken');

//here we have three parameters req,res,next  (next) used for a main purpose that will understand in future 
async function authVerify(req,res,next)
{
    const token=req.cookies.token;

    if(!token){
        return res.status(401).json({
            message:"unauthorised"
        })
    }
    try {
        const decoded=jwt.verify(token,process.env.TOKEN_SECRET);
        
        if(decoded.role!="artist"){
            return res.status(409).json({
                message:"you are not allowed to access this resource"
            })
        }
        req.user=decoded;
        next();
    }
    catch(err){
        return res.status(401).json({
            message:"invalid token"
        })
    }
}


async function authUser(req,res,next)
{
    const token=req.cookies.token;
    if(!token){
        return res.status(401).json({
            message:"unauthorised"
        })
    }
    try{
        const decoded=jwt.verify(token,process.env.TOKEN_SECRET);

        if(decoded.role!=="user"){
            return res.status(409).json({
                message:"you are not allowed to access this resource"
            })
        }
        req.user=decoded;
        next();
    }
    catch(err){
        return res.status(401).json({
            message:"invalid token"
        })
    }
} 


module.exports={authVerify , authUser};