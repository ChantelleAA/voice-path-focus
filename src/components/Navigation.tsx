import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';

export const Navigation = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Get display name - prioritize actual name, then create username from email
  const getDisplayName = () => {
    if (!user) return '';
    
    // Check if user has a full name (common with Google sign-in)
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    
    // Check if user has a name (another common field)
    if (user.user_metadata?.name) {
      return user.user_metadata.name;
    }
    
    // Check if user has a username
    if (user.user_metadata?.username) {
      return user.user_metadata.username;
    }
    
    // Create a username from email (everything before @)
    if (user.email) {
      const username = user.email.split('@')[0];
      // Clean up the username - capitalize first letter
      return username.charAt(0).toUpperCase() + username.slice(1);
    }
    
    return 'User';
  };

  const displayName = getDisplayName();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            VoicePath
          </Link>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">{displayName}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};