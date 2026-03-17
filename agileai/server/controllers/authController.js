import User from '../models/User.model.js';
import Organization from '../models/Organization.model.js';
import generateToken, { generateRefreshToken } from '../utils/generateToken.js';
import { apiResponse } from '../utils/apiResponse.js';

export const registerUser = async (req, res) => {
  const { name, email, password, role, organizationName } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    return apiResponse(res, 400, false, null, 'User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: role || 'developer',
  });

  if (user) {
    // Optionally create org
    if (organizationName) {
      const org = await Organization.create({
        name: organizationName,
        members: [{ user: user._id, role: user.role }],
      });
    }

    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    apiResponse(res, 201, true, {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: accessToken,
      refreshToken,
    }, 'User registered successfully');
  } else {
    apiResponse(res, 400, false, null, 'Invalid user data');
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (user && (await user.matchPassword(password))) {
    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Don't send password back
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };

    apiResponse(res, 200, true, { ...userData, token: accessToken, refreshToken }, 'Login successful');
  } else {
    apiResponse(res, 401, false, null, 'Invalid email or password');
  }
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    apiResponse(res, 200, true, user, 'User profile fetched');
  } else {
    apiResponse(res, 404, false, null, 'User not found');
  }
};

export const updateMe = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.avatar = req.body.avatar || user.avatar;

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    apiResponse(res, 200, true, {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
    }, 'Profile updated');
  } else {
    apiResponse(res, 404, false, null, 'User not found');
  }
};

export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return apiResponse(res, 401, false, null, 'No refresh token provided');
  }
  // Simplified for phase 1 - in reality we would verify and generate new
  apiResponse(res, 200, true, { token: 'new-token-stub' }, 'Token refreshed');
};

export const logoutUser = async (req, res) => {
  // In a real app we'd blacklist the token, for now just succeed
  apiResponse(res, 200, true, null, 'Logged out successfully');
};
