const allowedOrigins = [
  "http://localhost:3000",
  "https://127.0.0.1:3000",
  "http://10.184.3.133:3000",
  "http://10.184.3.133:5001",
  "http://10.184.3.133:5005",
  "http://10.184.3.133:5006",
  "http://10.184.3.133:5002",
  "http://10.184.3.133:5007",
  "http://10.184.3.133:5011",
  "http://14.139.180.41:3000",

  // Production. The portal and the capture app share this origin, so this one
  // entry covers both the pass screen and the applicant's capture page.
  "https://apacs.chennaiport.gov.in",

  // The capture PWA. It runs on its own origin because the applicant opens it
  // on their own phone, outside the portal.
  "http://localhost:4200",
];

module.exports = allowedOrigins;
