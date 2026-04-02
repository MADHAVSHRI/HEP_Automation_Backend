

const fs = require("fs");
const axios = require("axios");
const { successLogger, errorLogger } = require("../logger/logger");
const Agent = require("../models/agentRegistrationSchema");
const captchaService = require("../services/captchaService");
const sendEmailEvent = require("../utils/kafka/producer");

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
      // captchaToken,
      // captchaValue
    } = req.body;

    //Captcha validation

    // const validCaptcha = await captchaService.verifyCaptcha(
    //   captchaToken,
    //   captchaValue
    // );

    // if (!validCaptcha) {

    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid or expired captcha"
    //   });

    // }

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
          emailServiceUrl,
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

    const agents = await Agent.getAllRegisteredAgents();

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