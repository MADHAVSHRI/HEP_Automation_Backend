const ulipService=require("../services/ulipService");

exports.verifyVehicle=async(req,res)=>{

try{

const result=await ulipService.verifyVehicle(req.body.vehiclenumber);

res.json(result);

}catch(err){

res.status(err.status||500).json({

message:err.message

});

}

};

exports.verifyDL=async(req,res)=>{

try{

const result=await ulipService.verifyDL(req.body.dlnumber);

res.json(result);

}catch(err){

res.status(err.status||500).json({

message:err.message

});

}

};