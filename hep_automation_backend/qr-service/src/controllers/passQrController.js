const passQrService = require("../services/passQrService");

exports.generatePassQR = async (req,res) => {

  try{

    const { passRequestId } = req.params;

    if(!passRequestId){
      return res.status(400).json({
        success:false,
        message:"passRequestId required"
      });
    }

    const token = req.headers.authorization;

    const pdfBuffer = await passQrService.generatePass(passRequestId, token);

    res.setHeader("Content-Type","application/pdf");

    return res.send(pdfBuffer);

  }
  catch(error){

    if(error.message === "No approved passes found"){
        return res.status(404).json({
        success:false,
        message:error.message
        });
    }

    return res.status(500).json({
        success:false,
        message:error.message
    });
    }

};