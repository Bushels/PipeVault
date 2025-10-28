import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';

interface ContactSupportProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContactSupport: React.FC<ContactSupportProps> = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send the message to support
    console.log('Support message:', message);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setMessage('');
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Contact Support</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-green-400 font-semibold">Message sent!</p>
              <p className="text-gray-400 text-sm mt-2">
                Our team will get back to you shortly.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-400 mb-4">
                Having trouble? Send us a message and we'll help you out!
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Your Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    rows={5}
                    required
                    className="w-full bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="bg-gray-700 rounded-md p-4 mb-4">
                  <h3 className="text-sm font-semibold text-white mb-2">
                    You can also reach us:
                  </h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>📧 Email: support@mps.com</p>
                    <p>📞 Phone: 1-800-MPS-PIPE</p>
                    <p>🕐 Hours: Mon-Fri 8am-5pm MST</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={onClose}
                    className="flex-1 bg-gray-600 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Send Message
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

// Floating Support Button Component
export const FloatingSupport: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-indigo-500"
      aria-label="Contact Support"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <span className="sr-only">Contact Support</span>
    </button>
  );
};

export default ContactSupport;
