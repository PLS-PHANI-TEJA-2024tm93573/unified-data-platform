import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AssetService } from 'src/app/services/asset-service.service';

@Component({
  selector: 'app-asset-variable-dialog',
  standalone: false,
  templateUrl: './asset-variable-dialog.component.html',
  styleUrl: './asset-variable-dialog.component.scss'
})
export class AssetVariableDialogComponent {
  @Input() display: boolean = false;
  @Output() displayChange = new EventEmitter<boolean>();

  @Input() selectedAssetName: string = '';
  @Input() variables: any[] = [];


  constructor(private readonly assetService: AssetService){

  }

  onClose() {
    this.displayChange.emit(false);
  }
}
