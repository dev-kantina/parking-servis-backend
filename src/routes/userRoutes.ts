import { Router, IRouter } from 'express';
import { param, body } from 'express-validator';
import userController from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { Role } from '../../generated/prisma';

const router: IRouter = Router();

// Svi zahtjevi moraju biti autentifikovani
router.use(authenticate);

// GET /api/users/workers - Lista aktivnih radnika (za dropdown)
router.get(
  '/workers',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  userController.getWorkers.bind(userController)
);

// GET /api/users/workers/stats - Radnici sa statistikama
router.get(
  '/workers/stats',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  userController.getWorkersWithStats.bind(userController)
);

// GET /api/users - Lista svih korisnika (samo admin i menadžer)
router.get(
  '/',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  userController.getAll.bind(userController)
);

// POST /api/users - Kreiranje korisnika (samo admin)
router.post(
  '/',
  authorize(Role.ADMINISTRATOR),
  [
    body('email').isEmail().withMessage('Email mora biti validan'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Lozinka mora imati najmanje 6 karaktera'),
    body('firstName')
      .notEmpty()
      .withMessage('Ime je obavezno')
      .isLength({ max: 50 })
      .withMessage('Ime može imati najviše 50 karaktera'),
    body('lastName')
      .notEmpty()
      .withMessage('Prezime je obavezno')
      .isLength({ max: 50 })
      .withMessage('Prezime može imati najviše 50 karaktera'),
    body('role')
      .isIn(Object.values(Role))
      .withMessage('Nevažeća uloga'),
    body('phone').optional().isMobilePhone('any').withMessage('Nevažeći broj telefona'),
    validate,
  ],
  userController.create.bind(userController)
);

// GET /api/users/:id - Detalji korisnika
router.get(
  '/:id',
  authorize(Role.ADMINISTRATOR, Role.MANAGER),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  userController.getById.bind(userController)
);

// PUT /api/users/:id - Ažuriranje korisnika (samo admin)
router.put(
  '/:id',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Ime može imati najviše 50 karaktera'),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Prezime može imati najviše 50 karaktera'),
    body('role')
      .optional()
      .isIn(Object.values(Role))
      .withMessage('Nevažeća uloga'),
    body('phone').optional(),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Lozinka mora imati najmanje 6 karaktera'),
    validate,
  ],
  userController.update.bind(userController)
);

// DELETE /api/users/:id - Brisanje korisnika (samo admin)
router.delete(
  '/:id',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    validate,
  ],
  userController.delete.bind(userController)
);

// PATCH /api/users/:id/status - Aktivacija/deaktivacija korisnika (samo admin)
router.patch(
  '/:id/status',
  authorize(Role.ADMINISTRATOR),
  [
    param('id').isUUID().withMessage('ID mora biti validan UUID'),
    body('isActive').isBoolean().withMessage('isActive mora biti boolean'),
    validate,
  ],
  userController.updateStatus.bind(userController)
);

export default router;

