import { useRef } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  Link as LinkIcon, 
  Image, 
  Trash2,
  ListOrdered,
  List,
  Heading1
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

interface EditorToolbarProps {
  onDelete: () => void;
  isSaving: boolean;
  quillRef: React.RefObject<any>;
}

export default function EditorToolbar({ onDelete, isSaving, quillRef }: EditorToolbarProps) {
  const linkInputRef = useRef<HTMLInputElement>(null);
  
  const handleFormat = (format: string) => {
    const quill = quillRef.current?.getEditor();
    quill?.format(format, !quill.getFormat()[format]);
  };
  
  const handleLink = (url: string) => {
    const quill = quillRef.current?.getEditor();
    const range = quill?.getSelection();
    if (quill && range) {
      if (url) {
        quill.format('link', url);
      } else {
        quill.format('link', false);
      }
    }
  };
  
  const handleListFormat = (format: 'bullet' | 'ordered') => {
    const quill = quillRef.current?.getEditor();
    const formats = quill?.getFormat();
    
    if (formats && formats.list === format) {
      quill?.format('list', false);
    } else {
      quill?.format('list', format);
    }
  };
  
  const handleHeader = () => {
    const quill = quillRef.current?.getEditor();
    const formats = quill?.getFormat();
    
    if (formats && formats.header === 1) {
      quill?.format('header', false);
    } else {
      quill?.format('header', 1);
    }
  };

  return (
    <div className="border-b border-border p-1 flex items-center gap-1 bg-secondary/30 dark:bg-secondary/30">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleHeader()}
        className="h-8 w-8 text-foreground"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleFormat('bold')}
        className="h-8 w-8 text-foreground"
      >
        <Bold className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleFormat('italic')}
        className="h-8 w-8 text-foreground"
      >
        <Italic className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleFormat('underline')}
        className="h-8 w-8 text-foreground"
      >
        <Underline className="h-4 w-4" />
      </Button>
      
      <Separator orientation="vertical" className="mx-1 h-6" />
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleListFormat('bullet')}
        className="h-8 w-8 text-foreground"
      >
        <List className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => handleListFormat('ordered')}
        className="h-8 w-8 text-foreground"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      
      <Dialog>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-foreground"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="link">URL</Label>
              <Input
                ref={linkInputRef}
                id="link"
                placeholder="https://example.com"
                className="col-span-3"
              />
            </div>
            <Button 
              type="submit" 
              onClick={() => {
                handleLink(linkInputRef.current?.value || '');
              }}
            >
              Insert Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-foreground"
        id="toolbar-image"
      >
        <Image className="h-4 w-4" />
      </Button>
      
      <div id="toolbar" className="hidden"></div>
      
      <div className="ml-auto flex items-center gap-2">
        {isSaving && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete note</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this note? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
