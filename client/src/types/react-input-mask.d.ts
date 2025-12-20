declare module 'react-input-mask' {
  import * as React from 'react';

  export interface InputMaskProps extends React.InputHTMLAttributes<HTMLInputElement> {
    mask: string | (string | RegExp)[];
    maskChar?: string | null;
    formatChars?: { [key: string]: string };
    alwaysShowMask?: boolean;
    inputRef?: React.Ref<HTMLInputElement>;
    beforeMaskedValueChange?(
      newState: InputMaskState,
      oldState: InputMaskState,
      userInput: string,
      maskOptions: InputMaskOptions
    ): InputMaskState;
  }

  export interface InputMaskState {
    value: string;
    selection: {
      start: number;
      end: number;
    } | null;
  }

  export interface InputMaskOptions {
    mask: string;
    maskChar: string;
    alwaysShowMask: boolean;
    formatChars: Record<string, string>;
  }

  export class ReactInputMask extends React.Component<InputMaskProps> {}
  export default ReactInputMask;
}
