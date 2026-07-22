const generateOrderNumber = () => {
    return `HEP${Date.now()}`;
};

module.exports = generateOrderNumber;