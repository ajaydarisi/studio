
"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserCog, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const profileSchema = z.object({
  name: z.string().min(1, { message: 'Name is required.' }).max(100, {message: 'Name must be 100 characters or less.'}),
  email: z.string().email(), // Will be read-only
  phone: z.string().optional().or(z.literal('')) // Optional phone number
    .refine(val => !val || /^[+]?[0-9\s-()]{7,20}$/.test(val), {
      message: "Invalid phone number format."
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, isLoading: authLoading, session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.user_metadata?.name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { // Data for user_metadata
          name: data.name,
          phone: data.phone || null, // Store as null if empty for easier querying
        },
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Profile Updated',
        description: 'Your personal details have been saved.',
      });
      // The AuthContext's onAuthStateChange should pick up the USER_UPDATED event
      // and refresh the user object globally.
    } catch (error: any) {
      setFormError(error.message);
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (authLoading || (!session && typeof window !== 'undefined')) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-foreground">{authLoading ? "Loading profile..." : "Redirecting..."}</p>
      </div>
    );
  }

  if (!user && !authLoading) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>Please log in to view your profile.</CardDescription>
            </CardHeader>
            <CardContent>
                <Link href="/login">
                    <Button>Go to Login</Button>
                </Link>
            </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center rounded-full bg-primary/10 p-3 h-16 w-16">
            <UserCog className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Your Profile</CardTitle>
          <CardDescription>Manage your personal information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="e.g., John Doe"
                {...form.register('name')}
                className={form.formState.errors.name ? 'border-destructive' : ''}
                disabled={isSubmitting}
              />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...form.register('email')}
                readOnly // Email is usually not changed here, managed by auth provider
                className="bg-muted/50 cursor-not-allowed"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., +1 123-456-7890"
                {...form.register('phone')}
                className={form.formState.errors.phone ? 'border-destructive' : ''}
                disabled={isSubmitting}
              />
              {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
            </div>
            {formError && <p className="text-sm text-destructive text-center">{formError}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting || authLoading} size="lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center pt-4">
           <Link href="/">
             <Button variant="outline">Back to Tasks</Button>
           </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
