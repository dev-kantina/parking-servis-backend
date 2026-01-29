import { Router, IRouter } from 'express';
import { body } from 'express-validator';
import authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { authLimiter } from '../middleware/rateLimiter';

const router: IRouter = Router();

router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    validate,
  ],
  authController.register.bind(authController)
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  authController.login.bind(authController)
);

router.post(
  '/refresh',
  authLimiter,
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    validate,
  ],
  authController.refreshToken.bind(authController)
);

router.get('/profile', authenticate, authController.getProfile.bind(authController));

router.patch(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Trenutna lozinka je obavezna'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Nova lozinka mora imati najmanje 6 karaktera'),
    validate,
  ],
  authController.changePassword.bind(authController)
);

export default router;
