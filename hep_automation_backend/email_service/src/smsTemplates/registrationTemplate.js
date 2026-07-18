const registrationTemplate = (
  username,
  requestId,
  status,
  date
) => {

  return `Dear User - ${username},Your appointment to visit Chennai Port Authority on ${date} has been received and is ${status}. Your Request ID is: ${requestId}.Regards,Chennai Port Authority`;
  // return `Dear User, OTP to login to portal is : 96298. Valid for 5 minutes. CDAC`;
  // return `Dear User - N Mehanathen,Your appointment to visit Chennai Port Authority on 16-07-2026 has been received and is allowed. Your Request ID is: ABCD123.Regards,Chennai Port Authority`;
};

module.exports = registrationTemplate;