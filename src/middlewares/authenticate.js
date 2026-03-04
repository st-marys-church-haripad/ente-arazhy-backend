const { verifyAccessToken } = require('../lib/jwt');

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or malformed' });
        }
        const token = authHeader.split(' ')[1];
        const jwtPayload = verifyAccessToken(token);
        const userId = jwtPayload?.id || jwtPayload?._id || jwtPayload?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Invalid access token payload' });
        }
        req.userId = userId;
        req.user = {
            _id: userId,
            id: userId,
            userName: jwtPayload?.userName || jwtPayload?.username || null
        };
        return next();
    } catch (error) {
        next(error);
    }
}

module.exports = authenticate;