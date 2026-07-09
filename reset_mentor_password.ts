import { AuthService } from './src/services/auth';

async function resetMentorPassword() {
  try {
    await AuthService.resetPassword('7407463884', '123456');
    console.log('Mentor password reset to 123456');
  } catch (error) {
    console.error('Error resetting password:', error);
  }
}

resetMentorPassword();
