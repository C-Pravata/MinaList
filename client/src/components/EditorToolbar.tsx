import { useRef } from "react";
import { 
  Bold, 
  Italic, 
  Underline, 
  Link as LinkIcon, 
  Image, 
  List,
  Heading1,
  AlignLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  
  const handleListFormat = (format: 'bullet') => {
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
    <div className="border-b border-border py-1 px-3 flex items-center justify-center gap-1 bg-background">
      <div className="flex items-center max-w-lg mx-auto overflow-x-auto no-scrollbar">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => handleHeader()}
          className="h-9 w-9 rounded-full text-foreground"
          title="Heading"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => handleFormat('bold')}
          className="h-9 w-9 rounded-full text-foreground"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => handleFormat('italic')}
          className="h-9 w-9 rounded-full text-foreground"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => handleFormat('underline')}
          className="h-9 w-9 rounded-full text-foreground"
          title="Underline"
        >
          <Underline className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => handleListFormat('bullet')}
          className="h-9 w-9 rounded-full text-foreground"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full text-foreground"
              title="Insert Link"
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
          className="h-9 w-9 rounded-full text-foreground"
          id="toolbar-image"
          title="Insert Image"
        >
          <Image className="h-4 w-4" />
        </Button>
        
        <div id="toolbar" className="hidden"></div>
      </div>
    </div>
  );
}
