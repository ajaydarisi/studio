
"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { UserCog, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const profileSchema = z.object({
  name: z.string().min(1, { message: 'Name is required.' }).max(100, {message: 'Name must be 100 characters or less.'}),
  email: z.string().email(), // Will be read-only
  phone: z.string().optional().or(z.literal('')) 
    .refine(val => !val || /^[+]?[0-9\s-()]{7,20}$/.test(val), {
      message: "Invalid phone number format."
    }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, isLoading: authLoading, session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [pageLoading, setPageLoading] = useState(true); // Separate loading for initial data fetch
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
    } else if (user) {
      form.reset({
        name: user.user_metadata?.name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
      });
      setPageLoading(false);
    } else if (!authLoading && session && !user) {
      // Still waiting for user object after session is confirmed
      setPageLoading(true);
    } else if (!authLoading && !session) {
        setPageLoading(false); // No session, not loading, can show access denied or redirect
    }
  }, [authLoading, session, user, router, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }
    setFormError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          name: data.name,
          phone: data.phone || null,
        },
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Profile Updated',
        description: 'Your personal details have been saved.',
      });
      // AuthContext's onAuthStateChange should pick up USER_UPDATED
    } catch (error: any) {
      setFormError(error.message);
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  if (authLoading || pageLoading) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-foreground">{authLoading ? "Authenticating..." : "Loading profile..."}</p>
      </div>
    );
  }

  if (!user && !authLoading && !pageLoading) { // Ensure not loading before showing access denied
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., John Doe"
                        {...field}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                        readOnly
                        className="bg-muted/50 cursor-not-allowed"
                        disabled // Also disable to make it visually clear it's not editable
                      />
                    </FormControl>
                    <FormMessage /> 
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="e.g., +1 123-456-7890"
                        {...field}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {formError && <p className="text-sm text-destructive text-center">{formError}</p>}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || authLoading} size="lg">
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : 'Save Changes'}
              </Button>
            </form>
          </Form>
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
