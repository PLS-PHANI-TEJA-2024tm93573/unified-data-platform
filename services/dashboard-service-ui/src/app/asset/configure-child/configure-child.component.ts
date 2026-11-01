import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-configure-child',
  standalone: false,
  templateUrl: './configure-child.component.html',
  styleUrl: './configure-child.component.scss'
})
export class ConfigureChildComponent {

  @Input() displayDialog: boolean = false;
  @Output() displayDialogChange = new EventEmitter<boolean>();



  onSubmit(){
    this.onCloseDialog();
  }

  onCloseDialog(){
    this.displayDialogChange.emit(false)
  }

}
