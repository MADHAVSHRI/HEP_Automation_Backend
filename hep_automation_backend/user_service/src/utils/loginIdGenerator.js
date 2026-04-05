function generateLoginId() {

  const now = new Date();

  const dd = String(now.getDate()).padStart(2,"0");
  const mm = String(now.getMonth()+1).padStart(1,"0");
  const yy = String(now.getFullYear()).slice(-2);

  const unique = Date.now().toString().slice(-1);

  return `190${dd}${mm}${yy}${unique}`;
}

module.exports = generateLoginId;