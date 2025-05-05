import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { InfoIcon } from "lucide-react";
import { useState } from "react";

export default function FirebaseSetupInstructions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="flex items-center gap-1">
        <InfoIcon className="h-4 w-4" />
        Firebase Setup
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Firebase Configuration Instructions</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left space-y-4 mt-2">
                <p>
                  This application requires Firebase authentication. To use it properly, you need to
                  add the following environment variables:
                </p>

                <div className="bg-muted p-4 rounded-md text-xs">
                  <pre>
                    VITE_FIREBASE_API_KEY=your_api_key_here
                    VITE_FIREBASE_PROJECT_ID=your_project_id_here
                    VITE_FIREBASE_APP_ID=your_app_id_here
                  </pre>
                </div>

                <p className="font-medium text-primary">Setup steps:</p>
                <ol className="list-decimal list-outside ml-5 space-y-2">
                  <li>
                    Go to the{" "}
                    <a
                      href="https://console.firebase.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      Firebase console
                    </a>{" "}
                    and create a new project or select an existing one.
                  </li>
                  <li>Add a web app to your Firebase project by clicking on the web icon (&lt;/&gt;).</li>
                  <li>Register the app with a nickname (e.g., "Mina Notes Web").</li>
                  <li>
                    From the Firebase config, copy the <code className="bg-muted px-1 rounded">apiKey</code>,{" "}
                    <code className="bg-muted px-1 rounded">projectId</code>, and{" "}
                    <code className="bg-muted px-1 rounded">appId</code>.
                  </li>
                  <li>
                    Set these values in the Replit Secrets tab, naming them exactly as shown above.
                  </li>
                  <li>
                    In the Firebase Authentication section, enable Email/Password and Google sign-in methods.
                  </li>
                  <li>
                    Add your Replit app domain (e.g., your-repl.replit.app) to the authorized domains list
                    in the Firebase Authentication settings.
                  </li>
                </ol>

                <p>
                  After setting up these variables, restart the application to enable authentication.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="w-full sm:w-auto">Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}