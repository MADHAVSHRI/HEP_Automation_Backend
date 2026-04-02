const captchaStore = new Map();

const saveCaptcha = (token, text) => {
  captchaStore.set(token, text);
};

const getCaptcha = (token) => {
  return captchaStore.get(token);
};

const deleteCaptcha = (token) => {
  captchaStore.delete(token);
};

module.exports = {
  saveCaptcha,
  getCaptcha,
  deleteCaptcha
};