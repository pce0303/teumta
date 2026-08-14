import axios from 'axios';

import { API_BASE_URL } from '@/constants/config';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
});
