const crypto = require('crypto');
const User = require('../models/User');
const SECRET = process.env.AUTH_SECRET || 'godown-stock-management-change-this-secret';
function sign(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');return `${body}.${sig}`;}
function verify(token){if(!token)return null;const [body,sig]=String(token).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(!payload.exp||payload.exp<Date.now())return null;return payload;}
async function authRequired(req,res,next){try{const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const payload=verify(token);if(!payload?.id)return res.status(401).json({message:'Authentication required'});const user=await User.findById(payload.id);if(!user||!user.active)return res.status(401).json({message:'User is inactive or not found'});req.user=user;next();}catch(error){return res.status(401).json({message:'Invalid or expired authentication token'});}}
function allowRoles(...roles){return(req,res,next)=>{if(!req.user||!roles.includes(req.user.role))return res.status(403).json({message:'You do not have permission for this action'});next();};}
const createToken=(user)=>sign({id:String(user._id),role:user.role,exp:Date.now()+1000*60*60*24*7});
module.exports={authRequired,allowRoles,createToken};
