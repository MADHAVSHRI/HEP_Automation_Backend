const fs = require("fs");
const axios = require("axios");
const { successLogger, errorLogger } = require("../logger/logger");
const Agent = require("../models/agentRegistrationSchema");
const captchaService = require("../services/captchaService");
const sendEmailEvent = require("../utils/kafka/producer");
const bcrypt = require("bcrypt");
const generateLoginId = require("../utils/loginIdGenerator");
const AGENT_STATUS = require("../constants/constants").AGENT_STATUS;

exports.registerAgent = async (req, res) => {
  // helper function to delete uploaded files
  const deleteFiles = () => {
    const files = req.files || {};

    Object.values(files).forEach((fileArray) => {
      fileArray.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    });
  };

  try {
    // Extract uploaded files
    const entityFile = req.files?.entityFile?.[0]?.path || null;
    const gstinDoc = req.files?.gstinDoc?.[0]?.path || null;
    const panDoc = req.files?.panDoc?.[0]?.path || null;
    const tanDoc = req.files?.tanDoc?.[0]?.path || null;

    if (!entityFile || !gstinDoc || !panDoc) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "Required documents missing",
      });
    }

    const {
      userTypeId,
      userTypeName,
      entityName,
      mobileNo,
      email,

      addressLine,
      city,
      state,
      pincode,
      country,

      gstinNumber,
      panNumber,
      tanNumber,
      remark,

      title,
      firstName,
      lastName,
      contactMobile,
      contactEmail,

      termsAccepted: rawTermsAccepted,
      captchaToken,
      captchaValue
    } = req.body;

    //Captcha validation

    const validCaptcha = await captchaService.verifyCaptcha(
      captchaToken,
      captchaValue
    );

    if (!validCaptcha) {

      return res.status(400).json({
        success: false,
        message: "Invalid or expired captcha"
      });

    }

    const termsAccepted =
      String(rawTermsAccepted).trim().toLowerCase() === "true";

    if (!userTypeId || !entityName || !mobileNo || !email) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (!termsAccepted) {
      deleteFiles();
      return res.status(400).json({
        success: false,
        message: "You must accept Terms & Conditions",
      });
    }

    // Duplicate check
    const existingAgent = await Agent.findDuplicate(
      email,
      mobileNo,
      panNumber,
      gstinNumber,
    );

    if (existingAgent) {
      deleteFiles();
      return res.status(409).json({
        success: false,
        message: "User already registered with same email/mobile/PAN",
      });
    }

    // Insert DB
    const savedAgent = await Agent.create({
      userTypeId,
      userTypeName,
      entityName,
      mobileNo,
      email,

      entityFile,

      addressLine,
      city,
      state,
      pincode,
      country,

      gstinNumber,
      gstinDoc,

      panNumber,
      panDoc,

      tanNumber,
      tanDoc,

      remark,

      title,
      firstName,
      lastName,
      contactMobile,
      contactEmail,

      termsAccepted,
    });

    /* EMAIL SERVICE TRIGGER*/

    // try {

    //   const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    //   let emailResponse;

    //   if (!emailServiceUrl) {
    //     console.warn("EMAIL_SERVICE_URL not configured; skipping email send");
    //   } else {
    //     emailResponse = await axios.post(
    //       emailServiceUrl,
    //       {
    //         email: savedAgent.email,
    //         name: savedAgent.firstName,
    //         referenceNumber: savedAgent.referenceNumber
    //       },
    //       {
    //           headers: {
    //           "x-service-name": "User-service"
    //         }
    //       }
    //     );
    //   }

    //   // if email successfully sent
    //   if (emailResponse?.data?.success) {

    //     /* ADDED DB UPDATE */
    //     await Agent.updateEmailStatus(savedAgent.id);

    //   }

    // } catch (emailError) {

    //   console.error("Email sending failed:", emailError.message);

    // }

    let emailResponse = null;
    try {
      const emailServiceUrl = process.env.EMAIL_SERVICE_URL;

      if (!emailServiceUrl) {
        console.warn("EMAIL_SERVICE_URL not configured; skipping email send");
      } else {
        const start = Date.now();

        emailResponse = await axios.post(
          `${emailServiceUrl}/api/email/sendReferenceNo`,
          {
            email: savedAgent.email,
            name: savedAgent.firstName,
            referenceNumber: savedAgent.referenceNumber,
          },
          {
            headers: {
              "x-service-name": "USER-SERVICE",
            },
          },
        );

        const duration = Date.now() - start;

        const logMessage = `${new Date().toISOString()} | USER-SERVICE | POST | ${emailServiceUrl} | ${emailResponse.status} | ${duration}ms`;

        successLogger.info(logMessage);
      }

      /*
      ------------------------------------------------
      IF EMAIL SUCCESS -> UPDATE DB
      ------------------------------------------------
      */

      if (emailResponse?.status === 200 && emailResponse?.data?.success) {
        await Agent.updateEmailStatus(savedAgent.id);
      }
    } catch (emailError) {
      const statusCode = emailError.response?.status || 500;

      const logMessage = `${new Date().toISOString()} | USER-SERVICE | POST | EMAIL-SERVICE | ${statusCode} | ${emailError.message}`;

      errorLogger.error(logMessage);

      console.error("Email sending failed:", emailError.message);
      sendEmailEvent({
        email: savedAgent.email,
        name: savedAgent.firstName,
        referenceNumber: savedAgent.referenceNumber,
      });
    }

    /* ===============================
       RESPONSE SENT AFTER EMAIL
       =============================== */

    res.status(201).json({
      success: true,
      message: "Agent registered successfully",
      referenceNumber: savedAgent.referenceNumber,
      emailSent: emailResponse?.data?.success || false,
      data: savedAgent,
    });
  } catch (error) {
    deleteFiles();

    console.error("Agent Registration Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.updateEmailStatus = async (req, res) => {

  try {

    const { referenceNumber } = req.body;

    if (!referenceNumber) {
      return res.status(400).json({
        success: false,
        message: "referenceNumber required"
      });
    }

    await Agent.updateEmailStatusByReference(referenceNumber);

    res.json({
      success: true,
      message: "Email status updated"
    });

  } catch (error) {

    console.error("Update Email Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};


exports.getAllRegisteredUsers = async (req, res) => {

  try {

    const { isApproved } = req.query;
    const agents = await Agent.getAllRegisteredAgents(isApproved);

    return res.status(200).json({
      success: true,
      count: agents.length,
      data: agents
    });

  } catch (error) {

    console.error("Fetch agents error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agents"
    });

  }

};


exports.agentAction = async (req,res)=>{

  try{

    const {agentId, decision, rejectedReason} = req.body;
    console.log("Service Header:", req.headers["x-service-name"]);

    const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "APPROVAL";

    if(!emailServiceUrl){
      throw new Error("EMAIL_SERVICE_URL not configured");
    }

    if(!agentId || !decision){
      return res.status(400).json({
        success:false,
        message:"Agent ID and decision required"
      });
    }

    if(decision === AGENT_STATUS.APPROVED){

      // 1️⃣ Generate credentials
      const loginId = generateLoginId();
      const hashedPassword = await bcrypt.hash(defaultPassword,10);

      // 2️⃣ Update DB with credentials
      const agent = await Agent.approveAgent(
        agentId,
        loginId,
        hashedPassword
      );

      if(!agent){
        return res.status(404).json({
          success:false,
          message:"Agent not found"
        });
      }

      try{

        const emailResponse = await axios.post(
          `${emailServiceUrl}/api/email/sendApproval`,
          {
            email:agent.email,
            name:agent.firstName,
            loginId,
            password:defaultPassword,
            type:AGENT_STATUS.APPROVED
          }
        );

        if(emailResponse.data.success){

          await Agent.updateCredentialEmailStatus(agentId);

        }

      }catch(emailError){

        console.error("Email sending failed:",emailError.message);

      }

      return res.json({
        success:true,
        message:"Agent approved successfully"
      });

    }

    if(decision === AGENT_STATUS.REJECTED && rejectedReason){

      // 1️⃣ Update DB
      const agent = await Agent.rejectAgent(agentId, rejectedReason);

      if(!agent){
        return res.status(404).json({
          success:false,
          message:"Agent not found"
        });
      }

      // 2️⃣ Ensure reason exists
      if(!agent.rejectedReason){
        return res.status(500).json({
          success:false,
          message:"Rejection reason not stored"
        });
      }

      // 3️⃣ Send email AFTER DB success
      await axios.post(`${emailServiceUrl}/api/email/sendRejection`, {
        email: agent.email,
        name: agent.firstName,
        referenceNumber: agent.referenceNumber,
        reason: agent.rejectedReason,
        type: AGENT_STATUS.REJECTED
      });

      return res.status(201).json({
        success:true,
        message:"Agent rejected successfully"
      });

    }

  }catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:"Internal server error"
    });

  }

};


exports.getLoginUser = async (req, res) => {

  try {

    const { loginId } = req.body;

    if (!loginId) {
      return res.status(400).json({
        success: false,
        message: "loginId required"
      });
    }

    const user = await Agent.getLoginUser(loginId);

    return res.status(200).json({
      success: true,
      data: user || null
    });

  } catch (error) {

    console.error("Fetch login user error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });

  }

};

















    
