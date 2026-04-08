// API Configuration
const getApiUrl = () => {
  // Production (Vercel)
  if (process.env.NODE_ENV === 'production') {
    return 'https://kanang-alalay-backend.onrender.com/api';
  }
  // Development (localhost)
  return 'http://localhost:5000/api';
};

export const API_URL = getApiUrl();
console.log('🔧 API URL:', API_URL);

// Helper function for fetch requests
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};