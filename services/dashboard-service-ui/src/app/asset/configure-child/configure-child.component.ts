import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AssetService } from 'src/app/services/asset-service.service';
import { AssetChildren, AssetType } from 'src/interfaces/asset-type';

@Component({
  selector: 'app-configure-child',
  standalone: false,
  templateUrl: './configure-child.component.html',
  styleUrl: './configure-child.component.scss'
})
export class ConfigureChildComponent implements OnInit {

  @Input() displayDialog: boolean = false;
  @Input() assetId: string = '';
  @Output() displayDialogChange = new EventEmitter<boolean>();

  addChildDialog: boolean = false;

  assetChildren: AssetType[] = []

  constructor(private readonly assetService: AssetService){

  }

  ngOnInit(): void {

      this.assetService.getAssetChildren(this.assetId).subscribe((childrenResponse)=>{
        this.assetChildren = [...childrenResponse]
        console.log(this.assetChildren)
      })



  }

  onSubmit(){
    this.onCloseDialog();
  }

  onCloseDialog(){
    this.displayDialogChange.emit(false)
  }


  openAddChildDialog(){
    this.addChildDialog = true;
  }

  removeChildAsset(assetId:string) {
    this.assetService.removeAsset(assetId).subscribe(() => {
      this.assetChildren = this.assetChildren.filter((asset) => asset.id !== assetId);
    })
  }

}
